const logger = require('../../logger');
const LoanApplicationAction = require('../models/loan_application_action.model');
const LoanApplication = require('../models/loan_application.model');
const User = require('../models/user.model');
const constants = require('../assets/constants.json');
const moment = require('moment-timezone');

const updateLoanApplicationAction = async (req, res) => {
    try {
        const {LOAN_APPLICATION_WITNESS_ACTION_STATUS} = constants;
        const { loan_application_id, witness_id, status, reason } = req.body;

        logger.info('Payload to update loan application action:', req.body);

        // Validate required fields
        if (!loan_application_id || !witness_id || !status) {
            return res.status(400).json({
                success: false,
                message: 'loan_application_id, witness_id, and status are required'
            });
        }

        // Validate status value
        const validStatuses = LOAN_APPLICATION_WITNESS_ACTION_STATUS.ARRAY;
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Status must be approved, rejected, or pending'
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

        // Check if the witness exists
        const witness = await User.findById(witness_id);
        if (!witness) {
            return res.status(404).json({
                success: false,
                message: 'Witness not found'
            });
        }

        // Find the specific action record
        const actionRecord = await LoanApplicationAction.findOne({
            loan_application_id: loan_application_id,
            member_id: witness_id
        });

        if (!actionRecord) {
            return res.status(404).json({
                success: false,
                message: 'Action record not found for this witness and loan application'
            });
        }

        // Update the action record
        const updatePayload = {
            status: status,
            action_date: moment().tz('Asia/Kolkata').toDate()
        };

        if (reason) {
            updatePayload.reason = reason;
        }

        const updatedAction = await LoanApplicationAction.findByIdAndUpdate(
            actionRecord._id,
            updatePayload,
            { new: true }
        );

        logger.info('Loan application action updated successfully:', updatedAction._id);

        return res.status(200).json({
            success: true,
            message: 'Loan application action updated successfully',
            data: updatedAction
        });

    } catch (error) {
        logger.error('Error in updateLoanApplicationAction:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    updateLoanApplicationAction
};
