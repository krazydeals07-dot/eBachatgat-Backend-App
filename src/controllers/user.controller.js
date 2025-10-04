const User = require('../models/user.model');
const ShgGroup = require('../models/shg_group.model');
const logger = require('../../logger');
const bcrypt = require('bcrypt');
const { ROLES, GROUP_TRANSACTION_TYPES, GROUP_FLOW_TYPES } = require('../assets/constants.json');
const { encrypt } = require('../utils/passwordEncrypt');
const { saveGroupTransaction } = require('../utils/commonFunctions');
const handlebars = require('handlebars');
const transactionTemplates = require('../assets/transaction_templates.json');

// CREATE - Add new user
async function createUser(req, res) {
    try {
        logger.info(`Creating user payload : ${JSON.stringify(req.body)}`);
        const {
            shg_group_id,
            name,
            role,
            deposit_amount,
            joining_date,
            mobile_no,
            email,
            password,
            pan_card,
            aadhar_no,
            gender,
            address,
            nominee,
            nominee_relation,
            pincode
        } = req.body;

        // Validation for required fields
        if (!shg_group_id || !name || !role || !deposit_amount || !joining_date || !mobile_no || !password) {
            return res.status(400).json({
                message: 'shg_group_id, name, role, deposit_amount, joining_date, mobile_no, and password are required'
            });
        }

        // Check if SHG group exists
        const group = await ShgGroup.findById(shg_group_id);
        if (!group) {
            return res.status(404).json({ message: 'SHG group not found' });
        }

        // Check if user with same mobile number already exists in the group
        const existingUser = await User.findOne({
            mobile_no,
            shg_group_id
        });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this mobile number already exists in this group' });
        }

        // Check if email is provided and unique in the group
        if (email) {
            const existingEmail = await User.findOne({
                email,
                shg_group_id
            });
            if (existingEmail) {
                return res.status(409).json({ message: 'User with this email already exists in this group' });
            }
        }

        const { encrypted: encryptedPassword, iv: iv } = encrypt(password);

        const userPayload = {
            shg_group_id,
            name,
            role,
            deposit_amount,
            joining_date,
            mobile_no,
            email,
            password: encryptedPassword,
            iv: iv,
            pan_card,
            aadhar_no,
            gender,
            address,
            nominee,
            nominee_relation,
            is_completed_yn: true,
            pincode
        };

        logger.info(`User payload : ${JSON.stringify(userPayload)}`);

        const user = new User(userPayload);
        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        let notes = handlebars.compile(transactionTemplates.USER_DEPOSIT)({
            member_name: user.name,
            amount: deposit_amount
        });

        const gtPayload = {
            shg_group_id: shg_group_id,
            member_id: user?._id,
            amount: deposit_amount,
            flow_type: GROUP_FLOW_TYPES.IN,
            transaction_type: GROUP_TRANSACTION_TYPES.USER_DEPOSIT,
            reference_model: 'user',
            reference_id: user?._id,
            is_group_activity: false,
            notes: notes,
            // created_by_id: 'system'
        }

        await saveGroupTransaction(gtPayload).catch(error => {
            logger.error(`Error saving group transaction: ${JSON.stringify(error)}`);
        });

        res.status(201).json({
            message: 'User created successfully',
            data: userResponse
        });

    } catch (error) {
        logger.error(`Error creating user: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get user by ID
async function getUserById(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Getting user by ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'User retrieved successfully',
            data: user
        });

    } catch (error) {
        logger.error(`Error getting user by ID: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get all users by SHG group
async function getUsersByGroup(req, res) {
    try {
        const { shg_group_id } = req.query;
        logger.info(`Getting users by group ID: ${shg_group_id}`);

        if (!shg_group_id) {
            return res.status(400).json({ message: 'SHG group ID is required' });
        }

        // Check if SHG group exists
        const group = await ShgGroup.findById(shg_group_id);
        if (!group) {
            return res.status(404).json({ message: 'SHG group not found' });
        }

        const users = await User.find({
            shg_group_id
        }).select('-password');

        res.status(200).json({
            message: 'Users retrieved successfully',
            count: users.length,
            data: users
        });

    } catch (error) {
        logger.error(`Error getting users by group: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// UPDATE - Update user
async function updateUser(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Updating user ID: ${id}, payload: ${JSON.stringify(req.body)}`);

        if (!id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Check if user exists
        const existingUser = await User.findById(id);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const {
            name,
            role,
            deposit_amount,
            joining_date,
            mobile_no,
            email,
            pan_card,
            aadhar_no,
            gender,
            address,
            nominee,
            nominee_relation,
            is_completed_yn,
            pincode,
            password = null
        } = req.body;

        // Check if mobile number is being changed and if it already exists
        if (mobile_no && mobile_no !== existingUser.mobile_no) {
            const mobileExists = await User.findOne({
                mobile_no,
                shg_group_id: existingUser.shg_group_id,
                _id: { $ne: id }
            });
            if (mobileExists) {
                return res.status(409).json({ message: 'User with this mobile number already exists in this group' });
            }
        }

        // Check if email is being changed and if it already exists
        if (email && email !== existingUser.email) {
            const emailExists = await User.findOne({
                email,
                shg_group_id: existingUser.shg_group_id,
                _id: { $ne: id }
            });
            if (emailExists) {
                return res.status(409).json({ message: 'User with this email already exists in this group' });
            }
        }

        // Prepare update payload
        const updatePayload = {};
        if (name) updatePayload.name = name;
        if (role) updatePayload.role = role;
        if (deposit_amount) updatePayload.deposit_amount = deposit_amount;
        if (joining_date) updatePayload.joining_date = joining_date;
        if (mobile_no) updatePayload.mobile_no = mobile_no;
        if (email) updatePayload.email = email;
        if (pan_card) updatePayload.pan_card = pan_card;
        if (aadhar_no) updatePayload.aadhar_no = aadhar_no;
        if (gender) updatePayload.gender = gender;
        if (address) updatePayload.address = address;
        if (nominee) updatePayload.nominee = nominee;
        if (nominee_relation) updatePayload.nominee_relation = nominee_relation;
        if (pincode) updatePayload.pincode = pincode;
        if (typeof is_completed_yn === 'boolean') updatePayload.is_completed_yn = is_completed_yn;

        if (password) {
            const { encrypted: encryptedPassword, iv: iv } = encrypt(password);
            updatePayload.password = encryptedPassword;
            updatePayload.iv = iv;
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({
            message: 'User updated successfully',
            data: updatedUser
        });

    } catch (error) {
        logger.error(`Error updating user: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// DELETE - Soft delete user
async function deleteUser(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Deleting user ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is the only president in the group
        if (user.role === ROLES.PRESIDENT) {
            const presidentCount = await User.countDocuments({
                shg_group_id: user.shg_group_id,
                role: ROLES.PRESIDENT
            });
            if (presidentCount <= 1) {
                return res.status(400).json({
                    message: 'Cannot delete the only president of the group. Please assign another president first.'
                });
            }
        }

        // Soft delete by setting is_active_yn to false
        await User.deleteOne({ _id: id });

        res.status(200).json({
            message: 'User deleted successfully'
        });

    } catch (error) {
        logger.error(`Error deleting user: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    createUser,
    getUserById,
    getUsersByGroup,
    updateUser,
    deleteUser
};
