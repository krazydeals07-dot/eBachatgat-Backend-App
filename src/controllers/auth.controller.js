const ShgGroup = require('../models/shg_group.model');
const User = require('../models/user.model');
const logger = require('../../logger');
const { sign, verify, forgotPassword, verifyPassword } = require('../utils/jwt');
const randomatic = require('randomatic');
const { GROUP_FLOW_TYPES, GROUP_TRANSACTION_TYPES } = require('../assets/constants.json');
const { encrypt, decrypt } = require('../utils/passwordEncrypt');
const { ROLES } = require('../assets/constants.json');
const { saveGroupTransaction } = require('../utils/commonFunctions');
const handlebars = require('handlebars');
const transactionTemplates = require('../assets/transaction_templates.json');
const Subscription = require('../models/subscription.model');
const moment = require('moment-timezone');
const Settings = require('../models/settings.model');

async function registerGroup(req, res) {
    try {
        logger.info(`Registering group payload : ${JSON.stringify(req.body)}`);
        const { name, start_date, deposit_amount, president_name, president_mobile_no, president_email, password, state = "" } = req.body;

        if (!name || !start_date || !deposit_amount || !president_name || !president_mobile_no || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let code = 'SHG_';

        let isUnique = false;
        while (!isUnique) {
            let charPart = randomatic('A', 2);
            let numPart = randomatic('0', 5);
            code = 'SHG_' + charPart + numPart;
            const existingGroup = await ShgGroup.findOne({ code });
            if (!existingGroup) {
                isUnique = true;
            }
        }

        const existingGroup = await ShgGroup.findOne({ name });
        if (existingGroup) {
            return res.status(409).json({ message: 'A group with this name already exists' });
        }

        let shg_group_secret = randomatic('Aa0!', 7);

        let groupPayload = {
            name,
            start_date,
            state,
            code,
            is_active_yn: true,
            secret: shg_group_secret
        }
        logger.info(`Group payload : ${JSON.stringify(groupPayload)}`);

        const group = new ShgGroup(groupPayload);
        await group.save();

        const { encrypted, iv } = encrypt(password);

        let userPayload = {
            shg_group_id: group._id,
            name: president_name,
            role: ROLES.PRESIDENT,
            deposit_amount,
            joining_date: start_date,
            mobile_no: president_mobile_no,
            email: president_email,
            password: encrypted,
            iv: iv,
            is_completed_yn: false,
            is_active_yn: true
        }
        logger.info(`User payload : ${JSON.stringify(userPayload)}`);

        const user = new User(userPayload);
        await user.save();

        let subs_start_on = moment().toDate();
        let subs_end_on = moment().add(3, 'months').toDate();

        const freeSubscription = new Subscription({
            shg_group_id: group._id,
            starts_on: subs_start_on,
            ends_on: subs_end_on,
            amount: 0,
            is_free_trail: true,
            remarks: 'Free subscription for the first 3 months'
        });

        await freeSubscription.save();

        // Create default settings for the group
        const defaultSettingsData = {
            shg_group_id: group._id, // This will be the newly created group's ID
            savings_settings: {
                frequency: "monthly", // Options: "weekly", "monthly"
                amount: 100, // Default savings amount
                due_day: 1, // 1st of every month (1-31)
                grace_period_days: 5, // 5 days grace period
                penalty_amount: 10 // ₹10 penalty for late payments
            },
            loan_settings: {
                weekly_due_day: 1, // Monday (1-7, where 1=Monday, 7=Sunday)
                monthly_due_day: 1, // 1st of every month (1-31)
                grace_period_days: 7, // 7 days grace period for loans
                penalty_amount: 50, // ₹50 penalty for late loan payments
                interest_type: "fixed", // Options: "fixed", "variable"
                installment_type: "reducing", // Options: "flat", "reducing"
                interest_rate: 12, // 12% annual interest rate
                processing_fee: 100, // ₹100 processing fee
                loan_limit: 50000, // ₹50,000 maximum loan amount
                tenure_limit: 24, // 24 months maximum tenure
                preclose_penalty_rate: 2 // 2% penalty for pre-closure
            },
            meeting_settings: {
                frequency: "monthly", // Options: "weekly", "monthly"
                due_day: 1 // 1st of every month (1-31)
            }
        };

        const defaultSettings = new Settings(defaultSettingsData);
        await defaultSettings.save();

        let notes = handlebars.compile(transactionTemplates.USER_DEPOSIT)({
            member_name: user.name,
            amount: deposit_amount
        });

        let gtPayload = {
            shg_group_id: group._id,
            member_id: user._id,
            amount: deposit_amount,
            flow_type: GROUP_FLOW_TYPES.IN,
            transaction_type: GROUP_TRANSACTION_TYPES.USER_DEPOSIT,
            reference_model: 'user',
            reference_id: user._id,
            is_group_activity: false,
            notes: notes,
            // created_by_id: 'system'
        }

        await saveGroupTransaction(gtPayload).catch(error => {
            logger.error(`Error saving group transaction: ${JSON.stringify(error)}`);
        });

        res.status(201).json({
            message: 'Group registered successfully',
            group: group,
            user: user
        });
    } catch (error) {
        logger.error(`Error registering group: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

async function loginController(req, res) {
    try {
        logger.info(`Login payload : ${JSON.stringify(req.body)}`);
        const { shg_code, password, user_id } = req.body;

        if (!shg_code || !password || !user_id) {
            return res.status(400).json({ message: 'shg_code, password and user_id are required' });
        }

        const group = await ShgGroup.findOne({ code: shg_code });
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.is_active_yn) return res.status(401).json({ message: 'Group is not active' });

        const user = await User.findOne({ _id: user_id });
        if (!user) return res.status(404).json({ message: 'User not found' });
        logger.info(`User found : ${JSON.stringify(user)}`);

        const isPasswordValid = password === decrypt(user.password, user.iv);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid password' });
        logger.info(`Password is valid`);

        let username = user.name, role = user.role;
        const token = sign(shg_code, username, role);

        res.status(200).json({
            message: `${role.toUpperCase()} ${username} logged in successfully`,
            token: token,
            data: {
                shg_code,
                id: user._id,
                name: user.name,
                role: user.role,
                shg_group_id: user.shg_group_id,
                shg_group_name: group.name,
                secret: group.secret
            }
        });

    } catch (error) {
        logger.error(`Error logging in: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

async function listGroupsByCode(req, res) {
    try {
        logger.info(`Listing groups by code payload : ${JSON.stringify(req.body)}`);
        const { shg_code } = req.query;
        if (!shg_code) return res.status(400).json({ message: 'shg_code is required' });

        const group = await ShgGroup.findOne({ code: shg_code });
        if (!group) return res.status(404).json({ message: 'No groups found' });

        const shg_group_id = group._id;
        const users = await User.find({ shg_group_id: shg_group_id }).select('-password');

        res.status(200).json({
            message: 'Groups listed successfully',
            data: users
        });
    } catch (error) {
        logger.error(`Error listing groups by code: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

async function verifyToken(req, res) {
    try {
        const token = req.headers.authorization;
        if (!token) return res.status(401).json({ message: 'Unauthorized' });
        const tokenWithoutBearer = token.split(' ')[1];

        const decoded = verify(tokenWithoutBearer);
        if (!decoded) return res.status(401).json({ message: 'Invalid token' });
        logger.info(`Token verified successfully`);

        res.status(200).json({ message: 'Token verified successfully', valid: true });
    } catch (error) {
        logger.error(`Error verifying token: ${JSON.stringify(error)}`);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

async function verifyUserAuthenticity(req, res) {
    try {
        logger.info("Verify user authenticity payload ", req.body);

        let { shg_code, phoneNo, shg_group_name, shg_group_secret } = req.body;

        if (!shg_code || !phoneNo || !shg_group_name || !shg_group_secret) {
            return res.status(400).json({ message: 'shg_code, phoneNo, shg_group_name, and shg_group_secret are required' });
        }

        shg_group_name = shg_group_name.trim();

        const group = await ShgGroup.findOne({ name: shg_group_name, code: shg_code, secret: shg_group_secret });
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const user = await User.findOne({ mobile_no: phoneNo, shg_group_id: group._id });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const token = forgotPassword(shg_code, shg_group_secret);

        return res.status(200).json({ message: 'User authenticated successfully', success: true, token });

    } catch (error) {
        logger.error("Error while verify authenticity ", error);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

async function changePassword(req, res) {
    try {
        logger.info("Change password payload ", req.headers?.authorization);
        const { shg_code, shg_group_secret, newPassword } = req.body;

        if (!shg_code || !shg_group_secret || !newPassword) {
            return res.status(400).json({ message: 'shg_code, shg_group_secret, and newPassword are required' });
        }

        const token = req.headers?.authorization?.split(' ')[1];
        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        const decoded = await verifyPassword(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        if (decoded.shg_code !== shg_code || decoded.shg_group_secret !== shg_group_secret) {
            return res.status(401).json({ message: 'Invalid shg_code or shg_group_secret' });
        }

        const { encrypted: encryptedPassword, iv: iv } = encrypt(newPassword);
        const group = await ShgGroup.findOne({ code: shg_code, secret: shg_group_secret });

        const user = await User.findOne({ shg_group_id: group._id });
        user.password = encryptedPassword;
        user.iv = iv;
        await user.save();
        
        return res.status(200).json({ message: 'Password changed successfully', success: true });

    } catch (error) {
        logger.error("Error while change password ", error);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    registerGroup,
    loginController,
    listGroupsByCode,
    verifyToken,
    verifyUserAuthenticity,
    changePassword
}