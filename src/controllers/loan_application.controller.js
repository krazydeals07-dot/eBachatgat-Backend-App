const LoanApplication = require('../models/loan_application.model');
const User = require('../models/user.model');
const ShgGroup = require('../models/shg_group.model');
const LoanApplicationAction = require('../models/loan_application_action.model');
const logger = require('../../logger');
const constants = require('../assets/constants.json');
const { LOAN_WITNESS_COUNT, LOAN_APPLICATION_STATUS, LOAN_APPLICATION_WITNESS_ACTION_STATUS } = constants;

const createLoanRequest = async (req, res) => {
    try {
        logger.info('Payload to apply loan ', req.body);
        const { shg_group_id, member_id, amount_requested, purpose, collateral, tenure, interest_rate, interest_type, installment_type, installment_frequency, witness_ids = [], installment_amount, total_interest_amount } = req.body;

        if (!shg_group_id || !member_id || !amount_requested || !purpose || !tenure || !interest_rate || !interest_type || !installment_type || !installment_frequency || !witness_ids || !installment_amount || !total_interest_amount) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required except collateral'
            });
        }

        if (witness_ids.length < LOAN_WITNESS_COUNT) {
            return res.status(400).json({
                success: false,
                message: `At least ${LOAN_WITNESS_COUNT} witnesses are required`
            });
        }

        const shg_group = await ShgGroup.findById(shg_group_id);
        if (!shg_group) {
            return res.status(400).json({
                success: false,
                message: 'SHG group not found'
            });
        }

        const member = await User.findById(member_id);
        if (!member) {
            return res.status(400).json({
                success: false,
                message: 'Member not found'
            });
        }

        const witnessDeatils = await User.find({ _id: { $in: witness_ids } });
        if (witnessDeatils.length !== witness_ids.length) {
            return res.status(400).json({
                success: false,
                message: 'Some witnesses not found'
            });
        }

        const payload = {
            shg_group_id,
            member_id,
            amount_requested,
            purpose,
            collateral,
            tenure,
            interest_rate,
            interest_type,
            installment_type,
            installment_frequency,
            status: LOAN_APPLICATION_STATUS.PENDING,
            installment_amount,
            total_interest_amount
        }

        const loan_application = await LoanApplication.create(payload);

        const witnessActions = [];
        for (const witness of witnessDeatils) {
            const witnessPayload = {
                shg_group_id,
                loan_application_id: loan_application._id,
                member_id: witness._id,
                role: witness.role
            }
            witnessActions.push(witnessPayload);
        }

        await LoanApplicationAction.insertMany(witnessActions);

        return res.status(200).json({
            success: true,
            message: 'Loan request created successfully',
            data: loan_application
        });


    } catch (error) {
        logger.error('Error in createLoanRequest', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const getLoanApplicationsByStatus = async (req, res) => {
    try {
        const { status, shg_group_id } = req.query;

        // Validate status parameter
        if (!status || !shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'Status and shg_group_id are required'
            });
        }

        // Validate status value
        const validStatuses = LOAN_APPLICATION_STATUS.ARRAY;
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Build query object
        let query = { status: status, shg_group_id: shg_group_id };
        logger.info('Fetching loan applications with query:', query);

        const loanApplications = await LoanApplication.find(query)
            .sort({ createdAt: -1 });

        logger.info(`Found ${loanApplications.length} loan applications with status: ${status}`);

        return res.status(200).json({
            success: true,
            message: 'Loan applications fetched successfully',
            count: loanApplications.length,
            data: loanApplications
        });

    } catch (error) {
        logger.error('Error fetching loan applications by status:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const getLoanApplicationByWitnessId = async (req, res) => {
    try {
        logger.info('Payload to get loan application by witness id', req.body);
        const { witness_id, status = LOAN_APPLICATION_WITNESS_ACTION_STATUS.PENDING } = req.body;

        const loanApplicationWitnessActions = await LoanApplicationAction.find({ member_id: witness_id, status }).sort({ createdAt: -1 });

        let loanApplicationIds = loanApplicationWitnessActions.map(action => action.loan_application_id);

        const loanApplications = await LoanApplication.aggregate([
            {
                $match: {
                    _id: { $in: loanApplicationIds }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'member_id',
                    foreignField: '_id',
                    as: 'loan_requestor'
                }
            },
            {
                $unwind: '$loan_requestor'
            },
            {
                $project: {
                    _id: 1,
                    shg_group_id: 1,
                    amount_requested: 1,
                    purpose: 1,
                    collateral: 1,
                    tenure: 1,
                    interest_rate: 1,
                    interest_type: 1,
                    installment_type: 1,
                    installment_frequency: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    'loan_requestor.name': 1,
                    'loan_requestor.email': 1,
                    'loan_requestor.mobile_no': 1,
                    'loan_requestor.role': 1,
                }
            }
        ]);

        const loanApplicationActions = await LoanApplicationAction.aggregate([
            {
                $match: {
                    loan_application_id: { $in: loanApplicationIds }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'member_id',
                    foreignField: '_id',
                    as: 'member'
                }
            },
            {
                $unwind: '$member'
            },
            {
                $project: {
                    _id: 1,
                    shg_group_id: 1,
                    loan_application_id: 1,
                    member_id: 1,
                    role: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    'member.name': 1,
                    'member.email': 1,
                    'member.mobile_no': 1,
                    'member.role': 1,
                }
            }
        ]);

        let result = [];
        for (let ele of loanApplications) {
            let temp = { ...ele, actions: [] }, loanid = ele._id;

            for (let action of loanApplicationActions) {
                if (action.loan_application_id.toString() === loanid.toString()) {
                    temp.actions.push(action);
                }
            }
            result.push(temp);
        }

        logger.info('Loan applications', loanApplications);

        return res.status(200).json({
            success: true,
            message: 'Loan application fetched successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error in getLoanApplicationByWitnessId', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const getPendingLoanApplicationsWithCompletedWitnessActions = async (req, res) => {
    try {
        const { shg_group_id } = req.query;

        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }

        logger.info('Fetching pending loan applications with completed witness actions for group:', shg_group_id);

        // First, get all loan applications in pending status for the group
        const pendingLoanApplications = await LoanApplication.find({
            status: LOAN_APPLICATION_STATUS.PENDING,
            shg_group_id: shg_group_id
        }).sort({ createdAt: -1 });

        logger.info(`Found ${pendingLoanApplications.length} pending loan applications`);

        // Get all actions for these loan applications
        const loanApplicationIds = pendingLoanApplications.map(app => app._id);
        
        const allActions = await LoanApplicationAction.find({
            loan_application_id: { $in: loanApplicationIds }
        });

        // Group actions by loan application ID
        const actionsByLoanApplication = {};
        allActions.forEach(action => {
            if (!actionsByLoanApplication[action.loan_application_id]) {
                actionsByLoanApplication[action.loan_application_id] = [];
            }
            actionsByLoanApplication[action.loan_application_id].push(action);
        });

        // Filter loan applications where all witnesses have completed their actions
        const filteredLoanApplications = pendingLoanApplications.filter(loanApp => {
            const actions = actionsByLoanApplication[loanApp._id] || [];
            
            // Check if there are any pending actions
            const hasPendingActions = actions.some(action => action.status === LOAN_APPLICATION_STATUS.PENDING);
            
            // Return true if there are no pending actions (all witnesses have acted)
            return !hasPendingActions && actions.length > 0;
        });

        logger.info(`Found ${filteredLoanApplications.length} loan applications with completed witness actions`);

        // Get detailed information for each filtered loan application
        const result = await Promise.all(filteredLoanApplications.map(async (loanApp) => {
            const actions = actionsByLoanApplication[loanApp._id] || [];
            
            // Get witness details
            const witnessDetails = await Promise.all(actions.map(async (action) => {
                const user = await User.findById(action.member_id).select('name email mobile_no role');
                return {
                    _id: action._id,
                    member_id: action.member_id,
                    role: action.role,
                    status: action.status,
                    reason: action.reason,
                    action_date: action.action_date,
                    member: user
                };
            }));

            // Get loan requestor details
            const loanRequestor = await User.findById(loanApp.member_id).select('name email mobile_no role');

            return {
                _id: loanApp._id,
                shg_group_id: loanApp.shg_group_id,
                amount_requested: loanApp.amount_requested,
                purpose: loanApp.purpose,
                collateral: loanApp.collateral,
                tenure: loanApp.tenure,
                interest_rate: loanApp.interest_rate,
                interest_type: loanApp.interest_type,
                installment_type: loanApp.installment_type,
                installment_frequency: loanApp.installment_frequency,
                status: loanApp.status,
                createdAt: loanApp.createdAt,
                updatedAt: loanApp.updatedAt,
                loan_requestor: loanRequestor,
                witnesses: witnessDetails,
                approved_count: witnessDetails.filter(w => w.status === LOAN_APPLICATION_WITNESS_ACTION_STATUS.APPROVED).length,
                rejected_count: witnessDetails.filter(w => w.status === LOAN_APPLICATION_WITNESS_ACTION_STATUS.REJECTED).length,
                total_witnesses: witnessDetails.length,
                installment_amount: loanApp.installment_amount,
                total_interest_amount: loanApp.total_interest_amount
            };
        }));

        return res.status(200).json({
            success: true,
            message: 'Pending loan applications with completed witness actions fetched successfully',
            count: result.length,
            data: result
        });

    } catch (error) {
        logger.error('Error in getPendingLoanApplicationsWithCompletedWitnessActions:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateLoanApplicationStatus = async (req, res) => {
    try {
        const { loan_application_id, status, reject_reason } = req.body;

        logger.info('Payload to update loan application status:', req.body);

        // Validate required fields
        if (!loan_application_id || !status) {
            return res.status(400).json({
                success: false,
                message: 'loan_application_id and status are required'
            });
        }

        // Validate status value
        const validStatuses = LOAN_APPLICATION_STATUS.ARRAY;
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Status must be pending, approved, or rejected'
            });
        }

        // Validate reject_reason when status is rejected
        if (status === LOAN_APPLICATION_STATUS.REJECTED && !reject_reason) {
            return res.status(400).json({
                success: false,
                message: 'reject_reason is required when status is rejected'
            });
        }

        // Check if the loan application exists
        const loanApplication = await LoanApplication.findById(loan_application_id);
        if (!loanApplication) {
            return res.status(404).json({
                success: false,
                message: 'Loan application not found'
            });
        }

        // Prepare update payload
        const updatePayload = {
            status: status,
            updatedAt: new Date()
        };

        // Add reject_reason if status is rejected
        if (status === LOAN_APPLICATION_STATUS.REJECTED && reject_reason) {
            updatePayload.rejected_reason = reject_reason;
        }

        logger.info('Update payload:', updatePayload);
        
        // Update the loan application
        const updatedLoanApplication = await LoanApplication.findByIdAndUpdate(
            loan_application_id,
            updatePayload,
            { new: true }
        );

        logger.info('Loan application status updated successfully:', updatedLoanApplication._id);

        return res.status(200).json({
            success: true,
            message: 'Loan application status updated successfully',
            data: updatedLoanApplication
        });

    } catch (error) {
        logger.error('Error in updateLoanApplicationStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    createLoanRequest,
    getLoanApplicationsByStatus,
    getLoanApplicationByWitnessId,
    getPendingLoanApplicationsWithCompletedWitnessActions,
    updateLoanApplicationStatus
}