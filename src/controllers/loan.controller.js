const logger = require('../../logger');
const Loan = require('../models/loan.model');
const LoanApplication = require('../models/loan_application.model');
const Settings = require('../models/settings.model');
const EmiSchedule = require('../models/emi_schedule.model');
const User = require('../models/user.model');
const LoanPreclose = require('../models/loan_preclose.model');
const ShgGroup = require('../models/shg_group.model');
const { monthlyInstallmentCalculation, weeklyInstallmentCalculation, getFlatLoanBreakdown, getReducingLoanBreakdown } = require('../utils/loan_calculation');
const moment = require('moment-timezone');
const constants = require('../assets/constants.json');
const { ObjectId } = require('mongoose').Types;
const { LOAN_STATUS, LOAN_APPLICATION_STATUS, EMI_SCHEDULE_STATUS, GROUP_FLOW_TYPES, GROUP_TRANSACTION_TYPES } = constants;
const handlebars = require('handlebars');
const transactionTemplates = require('../assets/transaction_templates.json');
const { saveGroupTransaction, getCurrentBalanceByShgGroupId } = require('../utils/commonFunctions');
const PDFDocument = require('pdfkit');

const createLoan = async (req, res) => {
    try {
        const { loan_application_id } = req.body;

        if (!loan_application_id) {
            return res.status(400).json({ message: 'Loan application ID is required' });
        }

        const loanApplication = await LoanApplication.findOne({ _id: loan_application_id, status: LOAN_APPLICATION_STATUS.PENDING });

        if (!loanApplication) {
            return res.status(404).json({ message: 'Loan application not found' });
        }
        logger.info('Loan application found', loanApplication);

        const { current_balance } = await getCurrentBalanceByShgGroupId(loanApplication.shg_group_id).catch(err => {
            logger.error('Error in getCurrentBalanceByShgGroupId:', err);
            return res.status(500).json({ message: 'Internal server error' });
        });

        if (current_balance < loanApplication.amount_requested) {
            return res.status(400).json({ message: 'Insufficient balance in group' });
        }

        let settings = await Settings.findOne({ shg_group_id: loanApplication.shg_group_id });

        let loanAmount = loanApplication.amount_requested, interestRate = loanApplication.interest_rate, repaymentPeriod = loanApplication.tenure;

        let loanCalculationObject = loanApplication?.installment_frequency?.toLowerCase() == 'monthly' ? monthlyInstallmentCalculation : weeklyInstallmentCalculation;

        let loanInstallmentDetails = loanApplication?.installment_type?.toLowerCase() == 'flat'
            ? loanCalculationObject.flatInterestCalculation(loanAmount, interestRate, repaymentPeriod)
            : loanCalculationObject.reducingBalanceInterestCalculation(loanAmount, interestRate, repaymentPeriod);

        let installmentSchedule = [], remainingPrincipal = loanAmount, installmentFrequency = loanApplication?.installment_frequency?.toLowerCase();
        let loanSettings = settings?.loan_settings || {};
        let dueDay = installmentFrequency == 'monthly' ? loanSettings?.monthly_due_day : loanSettings?.weekly_due_day;
        let installmentStartDate = moment().tz('Asia/Kolkata').day(dueDay || 1);

        for (let i = 1; i <= loanInstallmentDetails.noOfInstallments; i++) {
            let dueDate = installmentStartDate.clone().add(i, installmentFrequency == 'monthly' ? 'month' : 'week');
            let finalDueDate = dueDate.clone().add(loanSettings?.grace_period_days || 0, 'days');

            let installmentBreakdown = loanApplication?.installment_type?.toLowerCase() == 'flat'
                ? getFlatLoanBreakdown(loanAmount, loanInstallmentDetails.totalInterest, loanInstallmentDetails.noOfInstallments, i)
                : getReducingLoanBreakdown(remainingPrincipal, interestRate, loanInstallmentDetails.installment, installmentFrequency == 'monthly');

            remainingPrincipal = installmentBreakdown.remainingPrincipal;
            installmentSchedule.push({
                shg_group_id: loanApplication.shg_group_id,
                loan_id: null,
                installment_number: i,
                due_date: dueDate.toDate(),
                final_due_date: finalDueDate.toDate(),
                principal_component: installmentBreakdown.principalComponent,
                interest_component: installmentBreakdown.interestComponent,
                remaining_principal: remainingPrincipal,
                status: EMI_SCHEDULE_STATUS.PENDING,
                total_installment_amount: loanInstallmentDetails.installment
            });

        }


        let payload = {
            shg_group_id: loanApplication.shg_group_id,
            loan_application_id: loanApplication._id,
            member_id: loanApplication.member_id,
            approved_amount: loanApplication.amount_requested,
            processing_fee: settings.loan_settings?.processing_fee || 0,
            tenure: loanApplication.tenure,
            interest_type: loanApplication.interest_type,
            interest_rate: loanApplication.interest_rate,
            installment_type: loanApplication.installment_type,
            installment_frequency: loanApplication.installment_frequency,
            installment_amount: loanInstallmentDetails.installment,
            loan_start_date: installmentSchedule[0].due_date,
            loan_end_date: installmentSchedule[installmentSchedule.length - 1].final_due_date,
            total_interest: loanInstallmentDetails.totalInterest,
            total_repayment_amount: loanInstallmentDetails.totalAmount,
            principal_balance: loanApplication.amount_requested,
            status: LOAN_STATUS.ACTIVE,
            no_of_installments: loanInstallmentDetails.noOfInstallments,
            collateral: loanApplication.collateral
        }

        logger.info('Loan payload', payload);

        const loan = await Loan.create(payload);

        logger.info('Loan created successfully', loan);

        for (let i = 0; i < installmentSchedule.length; i++) {
            installmentSchedule[i].loan_id = loan._id;
        }
        let emiSchedule = await EmiSchedule.insertMany(installmentSchedule);
        logger.info('Emi schedule created successfully', emiSchedule);

        let loanApplicationPayload = {
            status: LOAN_APPLICATION_STATUS.APPROVED
        }

        await LoanApplication.findByIdAndUpdate(loanApplication._id, loanApplicationPayload);

        const user = await User.findById(loanApplication.member_id);

        let template = transactionTemplates.LOAN_APPROVAL;
        let handlebarsTemplate = handlebars.compile(template);
        let loanApprovalNotes = handlebarsTemplate({
            member_name: user.name,
            amount: loanApplication.amount_requested
        });

        let gtLoanPayload = {
            shg_group_id: loanApplication.shg_group_id,
            // member_id: loanApplication.member_id,
            amount: loanApplication.amount_requested,
            flow_type: GROUP_FLOW_TYPES.OUT,
            transaction_type: GROUP_TRANSACTION_TYPES.LOAN_DISBURSED,
            reference_model: 'loan',
            reference_id: loan._id,
            is_group_activity: false,
            notes: loanApprovalNotes
        }

        await saveGroupTransaction(gtLoanPayload).catch(err => {
            logger.error('Error in saveGroupTransaction:', err);
        });

        template = transactionTemplates.LOAN_PROCESSING_FEE;
        handlebarsTemplate = handlebars.compile(template);
        let loanProcessingFeeNotes = handlebarsTemplate({
            member_name: user.name,
            amount: loanSettings?.processing_fee || 0,
            loan_id: loan._id
        });

        let gtProcessingFeePayload = {
            shg_group_id: loanApplication.shg_group_id,
            // member_id: loanApplication.member_id,
            amount: loanSettings?.processing_fee || 0,
            flow_type: GROUP_FLOW_TYPES.IN,
            transaction_type: GROUP_TRANSACTION_TYPES.LOAN_PROCESSING_FEE,
            reference_model: 'loan',
            reference_id: loan._id,
            is_group_activity: false,
            notes: loanProcessingFeeNotes
        }

        await saveGroupTransaction(gtProcessingFeePayload).catch(err => {
            logger.error('Error in saveGroupTransaction:', err);
        });

        return res.status(200).json({ message: 'Loan created successfully', data: loan });

    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const getLoansByStatus = async (req, res) => {
    try {
        const { status, shg_group_id } = req.query;

        // Validate status parameter
        if (!status || !shg_group_id) {
            return res.status(400).json({ message: 'Status and shg_group_id are required' });
        }

        // Validate status value
        const validStatuses = LOAN_STATUS.ARRAY;
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status. Status must be either ${validStatuses.join(' or ')}`
            });
        }

        // Build query object
        let query = { status: status, shg_group_id: shg_group_id };
        logger.info('Fetching loans with query:', query);

        const loans = await Loan.find(query)
            .sort({ createdAt: -1 });

        logger.info(`Found ${loans.length} loans with status: ${status}`);

        return res.status(200).json({
            message: `Loans fetched successfully`,
            count: loans.length,
            data: loans
        });

    } catch (error) {
        logger.error('Error fetching loans by status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const fetchLoanById = async (req, res) => {
    try {
        logger.info('Payload to fetch loan details ', req.query);
        const { loan_id } = req.query;

        if (!loan_id) {
            return res.status(400).json({ message: 'Loan ID is required' });
        }

        const loan = await Loan.findById(loan_id);
        if (!loan) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        const emiSchedule = await EmiSchedule.find({ loan_id: loan_id, status: { $in: [EMI_SCHEDULE_STATUS.PENDING, EMI_SCHEDULE_STATUS.SUBMITTED] } })
            .sort({ due_date: 1 })
            .limit(1);

        return res.status(200).json({
            message: 'Loan fetched successfully',
            data: loan,
            emiSchedule: emiSchedule[0] || {}
        });

    } catch (error) {
        logger.error('Error fetching loan by id:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const getLoanByMemberId = async (req, res) => {
    try {
        logger.info('Payload to fetch loan by member id ', req.query);
        const { shg_group_id, member_id = null, status } = req.query;

        if (!shg_group_id) {
            return res.status(400).json({ message: 'Shg group id is required' });
        }

        let temp = member_id?.split(',') || [];
        let memberIds = temp.map(id => new ObjectId(id));

        let query = { shg_group_id: new ObjectId(shg_group_id) };

        if (memberIds.length > 0) query['member_id'] = { $in: memberIds };
        if (status) query.status = status;
        logger.info('Payload to fetch loan by member id ', query);

        let limit = req.query?.limit ? parseInt(req.query.limit) : 50;
        let skip = req.query?.skip ? parseInt(req.query.skip) : 0;

        const loan = await Loan.aggregate([
            { $match: query },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'shg_groups',
                    localField: 'shg_group_id',
                    foreignField: '_id',
                    as: 'shg_group'
                }
            },
            {
                $unwind: '$shg_group'
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
            }
        ]);

        if (!loan) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        return res.status(200).json({ message: 'Loan fetched successfully', data: loan });
    } catch (error) {
        logger.error('Error fetching loan by member id:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const generateLoanReportPDF = async (req, res) => {
    try {
        logger.info('Generating loan report PDF for loan ID:', req.query.loan_id);
        const { loan_id } = req.query;

        if (!loan_id) {
            return res.status(400).json({ message: 'Loan ID is required' });
        }

        // Fetch loan details with populated references
        const loan = await Loan.findById(loan_id)
            .populate('member_id', 'name mobile_no email gender address')
            .populate('shg_group_id', 'name')
            .populate('loan_application_id', 'purpose');

        if (!loan) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        // Fetch all EMI schedule data for this loan
        const emiSchedule = await EmiSchedule.find({ loan_id: loan_id })
            .sort({ installment_number: 1 });

        // Create PDF document with better margins
        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
            bufferPages: true
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=loan-report-${loan_id}.pdf`);

        // Pipe the PDF to response
        doc.pipe(res);

        // Define colors
        const primaryColor = '#2c3e50';
        const secondaryColor = '#34495e';
        const accentColor = '#3498db';
        const lightGray = '#ecf0f1';
        const darkGray = '#7f8c8d';

        // Add header with background
        doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);

        // Add title
        doc.fillColor('white')
            .fontSize(24)
            .font('Helvetica-Bold')
            .text('LOAN DETAILS REPORT', 40, 30, { align: 'center' });

        // Add generated date in header
        doc.fillColor('white')
            .fontSize(10)
            .font('Helvetica')
            .text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm:ss')}`, 40, 55, { align: 'right' });

        // Reset position after header
        doc.y = 100;

        // Add loan basic details section with better formatting
        doc.fillColor(primaryColor)
            .fontSize(18)
            .font('Helvetica-Bold')
            .text('Loan Information', 40, doc.y);

        // Add underline
        const titleY = doc.y - 15;
        doc.moveTo(40, titleY + 20)
            .lineTo(200, titleY + 20)
            .strokeColor(accentColor)
            .lineWidth(2)
            .stroke();

        doc.moveDown(1.5);

        const loanDetails = [
            ['Loan ID:', loan._id.toString()],
            ['Member Name:', loan.member_id?.name || 'N/A'],
            ['Group Name:', loan.shg_group_id?.name || 'N/A'],
            ['Mobile Number:', loan.member_id?.mobile_no || 'N/A'],
            ['Email:', loan.member_id?.email || 'N/A'],
            ['Gender:', loan.member_id?.gender || 'N/A'],
            ['Address:', loan.member_id?.address || 'N/A'],
            ['Purpose:', loan.loan_application_id?.purpose || 'N/A'],
            ['Approved Amount:', Math.round(loan.approved_amount).toLocaleString('en-IN')],
            ['Processing Fee:', Math.round(loan.processing_fee).toLocaleString('en-IN')],
            ['Interest Rate:', `${loan.interest_rate}%`],
            ['Interest Type:', loan.interest_type.charAt(0).toUpperCase() + loan.interest_type.slice(1)],
            ['Installment Type:', loan.installment_type.charAt(0).toUpperCase() + loan.installment_type.slice(1)],
            ['Installment Frequency:', loan.installment_frequency.charAt(0).toUpperCase() + loan.installment_frequency.slice(1)],
            ['Installment Amount:', Math.round(loan.installment_amount).toLocaleString('en-IN')],
            ['Tenure:', `${loan.tenure} ${loan.installment_frequency === 'monthly' ? 'months' : 'weeks'}`],
            ['Total Installments:', loan.no_of_installments.toString()],
            ['Total Interest:', Math.round(loan.total_interest).toLocaleString('en-IN')],
            ['Total Repayment Amount:', Math.round(loan.total_repayment_amount).toLocaleString('en-IN')],
            ['Loan Start Date:', moment(loan.loan_start_date).format('DD/MM/YYYY')],
            ['Loan End Date:', moment(loan.loan_end_date).format('DD/MM/YYYY')],
            ['Status:', loan.status.charAt(0).toUpperCase() + loan.status.slice(1)],
            ['Collateral:', loan.collateral || 'N/A']
        ];

        // Create a table-like layout for loan details
        const startY = doc.y;
        const leftColumnX = 40;
        const rightColumnX = 300;
        const rowHeight = 25;

        // Add background for loan details section
        doc.rect(30, startY - 10, doc.page.width - 60, loanDetails.length * rowHeight + 20)
            .fillColor(lightGray)
            .fill();

        loanDetails.forEach(([label, value], index) => {
            const currentY = startY + (index * rowHeight);

            // Alternate row background
            if (index % 2 === 0) {
                doc.rect(30, currentY - 5, doc.page.width - 60, rowHeight)
                    .fillColor('white')
                    .fill();
            }

            // Label
            doc.fillColor(secondaryColor)
                .fontSize(11)
                .font('Helvetica-Bold')
                .text(label, leftColumnX, currentY);

            // Value
            doc.fillColor('black')
                .fontSize(11)
                .font('Helvetica')
                .text(value, rightColumnX, currentY);
        });

        // Position for EMI Schedule section - fix positioning
        const loanDetailsEndY = startY + (loanDetails.length * rowHeight) + 20;
        doc.y = loanDetailsEndY + 30;

        // Check if we need a new page for EMI Schedule
        if (doc.y > 650) {
            doc.addPage();
            doc.y = 50;
        }

        // Add EMI Schedule section header
        const emiHeaderY = doc.y;
        doc.fillColor(primaryColor)
            .fontSize(18)
            .font('Helvetica-Bold')
            .text('EMI Schedule', 40, emiHeaderY);

        // Add underline for EMI Schedule
        doc.moveTo(40, emiHeaderY + 20)
            .lineTo(160, emiHeaderY + 20)
            .strokeColor(accentColor)
            .lineWidth(2)
            .stroke();

        doc.y = emiHeaderY + 35;

        if (emiSchedule.length > 0) {
            // Table configuration with better proportions
            const tableStartY = doc.y;
            const pageWidth = doc.page.width;
            const tableWidth = pageWidth - 60; // More space for table
            const colWidths = [40, 70, 80, 80, 80, 100, 90]; // Better proportioned columns
            const rowHeight = 32; // Optimal row height

            // Calculate column positions starting from left margin
            const tableLeftMargin = 30;
            let colPositions = [tableLeftMargin];
            for (let i = 0; i < colWidths.length - 1; i++) {
                colPositions.push(colPositions[i] + colWidths[i]);
            }

            // Table headers
            const headers = ['No', 'Due Date', 'Principal', 'Interest', 'Total Amt', 'Remaining', 'Status'];
            const headerHeight = 40;

            // Draw header background with rounded corners effect
            doc.rect(tableLeftMargin, tableStartY, tableWidth, headerHeight)
                .fillColor(primaryColor)
                .fill();

            // Add subtle gradient effect with lighter shade on top
            doc.rect(tableLeftMargin, tableStartY, tableWidth, 8)
                .fillColor('#34495e')
                .fill();

            // Header text and borders
            headers.forEach((header, index) => {
                // Draw individual header cell with better borders
                doc.rect(colPositions[index], tableStartY, colWidths[index], headerHeight)
                    .strokeColor('#1a252f')
                    .lineWidth(1)
                    .stroke();

                // Header text with better positioning
                doc.fillColor('white')
                    .fontSize(10)
                    .font('Helvetica-Bold')
                    .text(header, colPositions[index] + 5, tableStartY + 15, {
                        width: colWidths[index] - 10,
                        align: 'center'
                    });
            });

            let currentY = tableStartY + headerHeight;

            emiSchedule.forEach((emi, index) => {
                // Check if we need a new page
                if (currentY > 720) {
                    doc.addPage();
                    const newPageHeaderY = 50;

                    // Add header background on new page
                    doc.rect(tableLeftMargin, newPageHeaderY, tableWidth, headerHeight)
                        .fillColor(primaryColor)
                        .fill();

                    // Add gradient effect on new page
                    doc.rect(tableLeftMargin, newPageHeaderY, tableWidth, 8)
                        .fillColor('#34495e')
                        .fill();

                    // Redraw headers on new page
                    headers.forEach((header, idx) => {
                        // Draw individual header cell border on new page
                        doc.rect(colPositions[idx], newPageHeaderY, colWidths[idx], headerHeight)
                            .strokeColor('#1a252f')
                            .lineWidth(1)
                            .stroke();

                        doc.fillColor('white')
                            .fontSize(10)
                            .font('Helvetica-Bold')
                            .text(header, colPositions[idx] + 5, newPageHeaderY + 15, {
                                width: colWidths[idx] - 10,
                                align: 'center'
                            });
                    });

                    currentY = newPageHeaderY + headerHeight;
                }

                // Enhanced row background with better colors
                const isEvenRow = index % 2 === 0;
                const bgColor = isEvenRow ? '#ffffff' : '#f8f9fa';

                // Draw row background
                doc.rect(tableLeftMargin, currentY, tableWidth, rowHeight)
                    .fillColor(bgColor)
                    .fill();

                // Add subtle row separator line
                if (!isEvenRow) {
                    doc.moveTo(tableLeftMargin, currentY)
                        .lineTo(tableLeftMargin + tableWidth, currentY)
                        .strokeColor('#e9ecef')
                        .lineWidth(0.5)
                        .stroke();
                }

                // Enhanced status color coding and formatting
                let statusColor = '#6c757d';
                let statusBgColor = '#f8f9fa';
                let statusText = emi.status.charAt(0).toUpperCase() + emi.status.slice(1);
                let statusBorderColor = '#dee2e6';

                if (emi.status === 'completed') {
                    statusColor = '#ffffff';
                    statusBgColor = '#28a745';
                    statusText = 'PAID';
                    statusBorderColor = '#1e7e34';
                } else if (emi.status === 'pending') {
                    statusColor = '#ffffff';
                    statusBgColor = '#ffc107';
                    statusText = 'PENDING';
                    statusBorderColor = '#d39e00';
                } else if (emi.status === 'overdue') {
                    statusColor = '#ffffff';
                    statusBgColor = '#dc3545';
                    statusText = 'OVERDUE';
                    statusBorderColor = '#c82333';
                } else if (emi.status === 'submitted') {
                    statusColor = '#ffffff';
                    statusBgColor = '#17a2b8';
                    statusText = 'SUBMITTED';
                    statusBorderColor = '#138496';
                }

                // Format numbers with better alignment
                const formatCurrency = (amount) => {
                    return Math.round(amount).toLocaleString('en-IN');
                };

                // Enhanced row data with better formatting and colors
                const rowData = [
                    { text: emi.installment_number.toString(), align: 'center', color: '#495057', font: 'Helvetica-Bold', size: 10 },
                    { text: moment(emi.due_date).format('DD/MM/YY'), align: 'center', color: '#6c757d', font: 'Helvetica', size: 9 },
                    { text: formatCurrency(emi.principal_component), align: 'center', color: '#0d6efd', font: 'Helvetica', size: 9 },
                    { text: formatCurrency(emi.interest_component), align: 'center', color: '#fd7e14', font: 'Helvetica', size: 9 },
                    { text: formatCurrency(emi.total_installment_amount), align: 'center', color: '#198754', font: 'Helvetica-Bold', size: 9 },
                    { text: formatCurrency(emi.remaining_principal), align: 'center', color: '#6c757d', font: 'Helvetica', size: 9 },
                    { text: statusText, align: 'center', color: statusColor, font: 'Helvetica-Bold', bgColor: statusBgColor, borderColor: statusBorderColor, size: 8 }
                ];

                // Draw enhanced individual cell borders and data
                rowData.forEach((item, colIndex) => {
                    const cellX = colPositions[colIndex];
                    const cellY = currentY;
                    const cellWidth = colWidths[colIndex];
                    const cellHeight = rowHeight;

                    // Draw individual cell border with better styling
                    doc.rect(cellX, cellY, cellWidth, cellHeight)
                        .strokeColor('#dee2e6')
                        .lineWidth(0.8)
                        .stroke();

                    // Enhanced status cell styling
                    if (colIndex === 6) {
                        // Status badge with rounded corners effect
                        const badgeMargin = 4;
                        const badgeX = cellX + badgeMargin;
                        const badgeY = cellY + badgeMargin;
                        const badgeWidth = cellWidth - (badgeMargin * 2);
                        const badgeHeight = cellHeight - (badgeMargin * 2);

                        // Status background
                        doc.rect(badgeX, badgeY, badgeWidth, badgeHeight)
                            .fillColor(item.bgColor)
                            .fill();

                        // Status border
                        doc.rect(badgeX, badgeY, badgeWidth, badgeHeight)
                            .strokeColor(item.borderColor)
                            .lineWidth(1.5)
                            .stroke();

                        // Re-draw the outer cell border
                        doc.rect(cellX, cellY, cellWidth, cellHeight)
                            .strokeColor('#dee2e6')
                            .lineWidth(0.8)
                            .stroke();
                    }

                    // Text positioning with proper vertical centering
                    const textY = cellY + (cellHeight / 2) - 4;
                    const textPadding = 5;

                    doc.fillColor(item.color)
                        .fontSize(item.size)
                        .font(item.font)
                        .text(item.text, cellX + textPadding, textY, {
                            width: cellWidth - (textPadding * 2),
                            align: item.align
                        });
                });

                // Enhanced penalty display
                if (emi.is_penalty_added && emi.penalty_amount > 0) {
                    const penaltyX = colPositions[4] + 3;
                    const penaltyY = currentY + rowHeight - 14;
                    const penaltyWidth = colWidths[4] - 6;

                    // Penalty badge
                    doc.rect(penaltyX, penaltyY, penaltyWidth, 10)
                        .fillColor('#fff3cd')
                        .fill();

                    doc.rect(penaltyX, penaltyY, penaltyWidth, 10)
                        .strokeColor('#ffeaa7')
                        .lineWidth(1)
                        .stroke();

                    doc.fillColor('#856404')
                        .fontSize(6)
                        .font('Helvetica-Bold')
                        .text(`⚠ ₹${Math.round(emi.penalty_amount).toLocaleString('en-IN')}`,
                            penaltyX + 2, penaltyY + 2, {
                            width: penaltyWidth - 4,
                            align: 'center'
                        });
                }

                currentY += rowHeight;
            });

            // Add summary section with better formatting
            currentY += 30;

            // Summary section header
            // doc.fillColor(primaryColor)
            //    .fontSize(16)
            //    .font('Helvetica-Bold')
            //    .text('Summary', 40, currentY);

            // // Add underline for Summary
            // doc.moveTo(40, currentY + 20)
            //    .lineTo(120, currentY + 20)
            //    .strokeColor(accentColor)
            //    .lineWidth(2)
            //    .stroke();

            // currentY += 40;

            // const totalPrincipal = emiSchedule.reduce((sum, emi) => sum + emi.principal_component, 0);
            // const totalInterest = emiSchedule.reduce((sum, emi) => sum + emi.interest_component, 0);
            // const totalPenalty = emiSchedule.reduce((sum, emi) => sum + (emi.penalty_amount || 0), 0);
            // const completedInstallments = emiSchedule.filter(emi => emi.status?.toLowerCase() === 'completed').length;
            // const pendingInstallments = emiSchedule.filter(emi => emi.status?.toLowerCase() === 'pending').length;
            // const overdueInstallments = emiSchedule.filter(emi => emi.status?.toLowerCase() === 'overdue').length;

            // Summary data in a nice layout with better formatting
            // const summaryData = [
            //     ['Total Principal Amount:', Math.round(totalPrincipal).toLocaleString('en-IN')],
            //     ['Total Interest Amount:', Math.round(totalInterest).toLocaleString('en-IN')],
            //     ['Total Penalty Amount:', Math.round(totalPenalty).toLocaleString('en-IN')],
            //     ['Completed Installments:', `${completedInstallments} of ${emiSchedule.length}`],
            //     ['Pending Installments:', (emiSchedule.length - completedInstallments)],
            //     ['Overdue Installments:', overdueInstallments],
            //     ['Total Amount Payable:', Math.round(totalPrincipal + totalInterest + totalPenalty).toLocaleString('en-IN')]
            // ];

            // // Summary background
            // const summaryHeight = summaryData.length * 25 + 20;
            // doc.rect(30, currentY - 10, doc.page.width - 60, summaryHeight)
            //    .fillColor('#f8f9fa')
            //    .fill();

            // summaryData.forEach(([label, value], index) => {
            //     const summaryY = currentY + (index * 25);

            //     // Label
            //     doc.fillColor(secondaryColor)
            //        .fontSize(12)
            //        .font('Helvetica-Bold')
            //        .text(label, 40, summaryY);

            //     // Value with color coding
            //     let valueColor = 'black';
            //     if (label.includes('Penalty') && totalPenalty > 0) valueColor = '#e74c3c';
            //     if (label.includes('Overdue') && overdueInstallments > 0) valueColor = '#e74c3c';
            //     if (label.includes('Completed')) valueColor = '#27ae60';

            //     doc.fillColor(valueColor)
            //        .fontSize(12)
            //        .font('Helvetica-Bold')
            //        .text(value, 300, summaryY);
            // });

        } else {
            doc.fillColor('black')
                .fontSize(14)
                .font('Helvetica')
                .text('No EMI schedule found for this loan.', 40, doc.y + 20);
        }

        // Add footer with better styling
        const footerY = doc.page.height - 60;

        // Footer background
        doc.rect(0, footerY, doc.page.width, 60)
            .fillColor('#f8f9fa')
            .fill();

        // Footer border
        doc.moveTo(0, footerY)
            .lineTo(doc.page.width, footerY)
            .strokeColor('#bdc3c7')
            .lineWidth(1)
            .stroke();

        // Footer text
        // doc.fillColor(darkGray)
        //    .fontSize(10)
        //    .font('Helvetica')
        //    .text('This is a computer generated report. No signature required.', 40, footerY + 15)
        //    .text(`Report generated on: ${moment().format('DD/MM/YYYY HH:mm:ss')}`, 40, footerY + 35);

        // Finalize the PDF
        doc.end();

        logger.info('Loan report PDF generated successfully for loan ID:', loan_id);

    } catch (error) {
        logger.error('Error generating loan report PDF:', error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
};

const getPreCloseLoanData = async (req, res) => {
    try {
        const { loan_id } = req.query;

        if (!loan_id) {
            return res.status(400).json({ message: 'Loan ID is required' });
        }

        const loan = await Loan.aggregate([
            {
                $match: {
                    _id: new ObjectId(loan_id)
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
                $unwind: {
                    path: '$member',
                    preserveNullAndEmptyArrays: true
                }
            }
        ]);

        if (!loan) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        let shg_group_id = loan[0].shg_group_id;

        let settings = await Settings.findOne({ shg_group_id: shg_group_id });
        let loanSettings = settings.loan_settings;

        let preclosePenaltyRate = loanSettings.preclose_penalty_rate;
        let preclosePenaltyAmount = loan[0].principal_balance * (preclosePenaltyRate / 100);

        let returnData = {
            ...loan[0],
            preclose_penalty_amount: preclosePenaltyAmount,
            preclose_penalty_rate: preclosePenaltyRate
        }

        return res.status(200).json({ message: 'Preclose loan data fetched successfully', data: returnData });

    } catch (error) {
        logger.error('Error in getPreCloseLoanData:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const loanPreclosing = async (req, res) => {
    try {
        const { shg_group_id, loan_id, total_preclose_amount, approved_by, notes } = req.body;

        if (!shg_group_id || !loan_id || !total_preclose_amount || !approved_by) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let shgGroupData = await ShgGroup.findOne({ _id: new ObjectId(shg_group_id) });
        if (!shgGroupData) {
            return res.status(404).json({ message: 'SHG group not found' });
        }

        let loan = await Loan.findOne({ _id: new ObjectId(loan_id), shg_group_id });

        if (!loan) {
            return res.status(404).json({ message: 'Loan not found' });
        }

        const approvedByMember = await User.findOne({ _id: new ObjectId(approved_by), shg_group_id });
        if (!approvedByMember) {
            return res.status(404).json({ message: 'Approved by member not found' });
        }

        let settings = await Settings.findOne({ shg_group_id });
        let loanSettings = settings.loan_settings;

        let preclosePenaltyRate = loanSettings.preclose_penalty_rate;
        let preclosePenaltyAmount = loan.principal_balance * (preclosePenaltyRate / 100);

        let totalPrecloseAmt = loan.principal_balance + preclosePenaltyAmount;

        if (total_preclose_amount < totalPrecloseAmt) {
            return res.status(400).json({ message: 'Total preclose amount is less than the total preclose amount' });
        }

        const currentInstallmentEmi = await EmiSchedule.find({ shg_group_id: shg_group_id, loan_id: loan_id, status: EMI_SCHEDULE_STATUS.PENDING }).sort({ installment_number: 1 }).limit(1);
        const installmentNo = currentInstallmentEmi && currentInstallmentEmi?.length > 0 && currentInstallmentEmi[0].installment_number ? currentInstallmentEmi[0].installment_number : -1;

        let preclosePayload = {
            shg_group_id: shg_group_id,
            loan_id: loan_id,
            total_preclose_amount: total_preclose_amount,
            principal_amount: loan.principal_balance,
            preclose_charge_amount: preclosePenaltyAmount,
            approved_by: approvedByMember._id,
            close_on_installment_no: installmentNo,
            notes: notes
        }

        await EmiSchedule.updateMany({ shg_group_id: shg_group_id, loan_id: loan_id, status: EMI_SCHEDULE_STATUS.PENDING }, { $set: { status: EMI_SCHEDULE_STATUS.COMPLETED } }).catch(err => {
            logger.error('Error in updating emi schedule status:', err);
            return res.status(500).json({ message: 'Internal server error' });
        });

        await Loan.updateOne({ _id: new ObjectId(loan_id), shg_group_id }, { $set: { status: LOAN_STATUS.CLOSED, is_loan_preclosed_yn: true } }).catch(err => {
            logger.error('Error in updating loan status:', err);
            return res.status(500).json({ message: 'Internal server error' });
        });

        let precloseLoan = await LoanPreclose.create(preclosePayload);

        if (!precloseLoan) {
            return res.status(400).json({ message: 'Failed to create preclose loan' });
        }

        let loanTakerData = await User.findOne({ _id: new ObjectId(loan.member_id), shg_group_id });

        let template = transactionTemplates.LOAN_PRECLOSE;
        let handlebarsTemplate = handlebars.compile(template);
        let loanPrecloseNotes = handlebarsTemplate({
            member_name: loanTakerData?.name,
            amount: totalPrecloseAmt,
            approved_by: approvedByMember.name,
            preclose_date: moment().format('DD/MM/YYYY')
        });

        let gtLoanPayload = {
            shg_group_id,
            // member_id: loanTakerData._id,
            amount: total_preclose_amount,
            flow_type: GROUP_FLOW_TYPES.IN,
            transaction_type: GROUP_TRANSACTION_TYPES.LOAN_PRECLOSE,
            reference_model: 'loan',
            reference_id: loan._id,
            is_group_activity: false,
            notes: loanPrecloseNotes
        }

        await saveGroupTransaction(gtLoanPayload).catch(err => {
            logger.error('Error in saveGroupTransaction:', err);
        });

        return res.status(200).json({ message: 'Loan preclosed successfully', data: precloseLoan });

    } catch (error) {
        logger.error('Error in loanPreclosing:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

const getLoanSummaryByMemberAndGroup = async (req, res) => {
    try {
        const { member_id, shg_group_id } = req.query;

        if (!member_id || !shg_group_id) {
            return res.status(400).json({ 
                message: 'Member ID and SHG Group ID are required' 
            });
        }

        // 1. Total loan - Sum of approved_amount for all loans by member and shg group
        const totalLoanResult = await Loan.aggregate([
            {
                $match: {
                    member_id: new ObjectId(member_id),
                    shg_group_id: new ObjectId(shg_group_id)
                }
            },
            {
                $group: {
                    _id: null,
                    total_loan_amount: { $sum: '$total_repayment_amount' }
                }
            }
        ]);
        logger.info('totalLoanResult', totalLoanResult);
        const totalLoanAmount = totalLoanResult.length > 0 ? totalLoanResult[0].total_loan_amount : 0;

        // 2. Paid loan - Sum of total_installment_amount for completed EMIs
        const paidLoanResult = await EmiSchedule.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                    status: EMI_SCHEDULE_STATUS.COMPLETED
                }
            },
            {
                $lookup: {
                    from: 'loans',
                    localField: 'loan_id',
                    foreignField: '_id',
                    as: 'loan'
                }
            },
            {
                $unwind: '$loan'
            },
            {
                $match: {
                    'loan.member_id': new ObjectId(member_id)
                }
            },
            {
                $group: {
                    _id: null,
                    paid_loan_amount: { $sum: '$total_installment_amount' }
                }
            }
        ]);
        logger.info('paidLoanResult', paidLoanResult);

        const paidLoanAmount = paidLoanResult.length > 0 ? paidLoanResult[0].paid_loan_amount : 0;

        // 3. Due loan - Sum of total_repayment_amount minus paid amount
        const dueLoanResult = await Loan.aggregate([
            {
                $match: {
                    member_id: new ObjectId(member_id),
                    shg_group_id: new ObjectId(shg_group_id)
                }
            },
            {
                $group: {
                    _id: null,
                    total_repayment_amount: { $sum: '$total_repayment_amount' }
                }
            }
        ]);
        logger.info('dueLoanResult', dueLoanResult);

        const totalRepaymentAmount = dueLoanResult.length > 0 ? dueLoanResult[0].total_repayment_amount : 0;
        const dueLoanAmount = totalRepaymentAmount - paidLoanAmount;

        const loanSummary = {
            member_id,
            shg_group_id,
            total_loan_amount: totalLoanAmount,
            paid_loan_amount: paidLoanAmount,
            due_loan_amount: dueLoanAmount,
            total_repayment_amount: totalRepaymentAmount
        };

        logger.info('Loan summary generated successfully', { member_id, shg_group_id, loanSummary });

        return res.status(200).json({
            success: true,
            message: 'Loan summary retrieved successfully',
            data: loanSummary
        });

    } catch (error) {
        logger.error('Error in getLoanSummaryByMemberAndGroup:', error);
        return res.status(500).json({ 
            message: 'Internal server error',
            error: error.message 
        });
    }
}

module.exports = {
    createLoan,
    getLoansByStatus,
    fetchLoanById,
    getLoanByMemberId,
    generateLoanReportPDF,
    getPreCloseLoanData,
    loanPreclosing,
    getLoanSummaryByMemberAndGroup
}