require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const connectDB = require('./src/utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

const logger = require('./logger');

const authRoutes = require('./src/routes/auth.route');
const userRoutes = require('./src/routes/user.route');
const settingRoutes = require('./src/routes/setting.route');
const savingRoutes = require('./src/routes/saving.route');
const loanApplicationRoutes = require('./src/routes/loan_application.route');
const loanRoutes = require('./src/routes/loan.route');
const installmentRoutes = require('./src/routes/installment.route');
const loanPaymentRoutes = require('./src/routes/loan_payment.route');
const loanApplicationActionRoutes = require('./src/routes/loan_application_action.route');
const groupTransactionRoutes = require('./src/routes/group_transaction.route');
const summaryRoutes = require('./src/routes/summary.route');
const shgGroupRoutes = require('./src/routes/shg_group.route');
const ruleNoticeRoutes = require('./src/routes/rule_notice.route');
const govtSchemesRoutes = require('./src/routes/govt_schemes.route');
const adminRoutes = require('./src/routes/admin.route');
const junkRoutes = require('./src/routes/junk.route');
const subscriptionRoutes = require('./src/routes/subscription.route');
const issueRoutes = require('./src/routes/issue.route');

const upload = multer();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(upload.any()); // Middleware for handling multipart/form-data

// Connect to MongoDB
connectDB();

// Routes
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Backend is running',
        status: 'success',
        name: 'E-Bachatgat'
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/setting', settingRoutes);
app.use('/api/saving', savingRoutes);
app.use('/api/loan-application', loanApplicationRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/installment', installmentRoutes);
app.use('/api/loan-payment', loanPaymentRoutes);
app.use('/api/loan-application-action', loanApplicationActionRoutes);
app.use('/api/group-transaction', groupTransactionRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/shg-group', shgGroupRoutes);
app.use('/api/rule-notice', ruleNoticeRoutes);
app.use('/api/govt-schemes', govtSchemesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/junk', junkRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/issues', issueRoutes);

// Start server
app.listen(PORT, () => {
    logger.info(`Server is deployed on port - ${PORT}`);
}); 