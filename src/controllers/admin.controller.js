const Admin = require('../models/admin.model');
const logger = require('../../logger');
const { sign, verify } = require('../utils/jwt');
const { encrypt, decrypt } = require('../utils/passwordEncrypt');

// REGISTER - Create new admin
async function registerAdmin(req, res) {
    try {
        logger.info(`Registering admin payload: ${JSON.stringify(req.body)}`);
        const {
            name,
            email,
            mobile_no,
            password
        } = req.body;

        // Validation for required fields
        if (!name || !email || !mobile_no || !password) {
            return res.status(400).json({
                message: 'All fields are required: name, email, mobile_no, password'
            });
        }

        // Check if admin with same email already exists
        const existingEmailAdmin = await Admin.findOne({ email });
        if (existingEmailAdmin) {
            return res.status(409).json({ message: 'Admin with this email already exists' });
        }

        // Check if admin with same mobile number already exists
        const existingMobileAdmin = await Admin.findOne({ mobile_no });
        if (existingMobileAdmin) {
            return res.status(409).json({ message: 'Admin with this mobile number already exists' });
        }

        const { encrypted: encryptedPassword, iv: iv } = encrypt(password);

        const adminPayload = {
            name,
            email,
            mobile_no,
            password: encryptedPassword,
            iv: iv
        };

        logger.info(`Admin payload: ${JSON.stringify(adminPayload)}`);

        const admin = new Admin(adminPayload);
        await admin.save();

        // Remove password from response
        const adminResponse = admin.toObject();
        delete adminResponse.password;
        delete adminResponse.iv;

        res.status(201).json({
            message: 'Admin registered successfully',
            data: adminResponse
        });

    } catch (error) {
        logger.error(`Error registering admin: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// LOGIN - Admin authentication
async function loginAdmin(req, res) {
    try {
        logger.info(`Admin login payload: ${JSON.stringify(req.body)}`);
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }
        logger.info(`Admin found: ${JSON.stringify({ id: admin._id, name: admin.name, email: admin.email })}`);

        const isPasswordValid = password === decrypt(admin.password, admin.iv);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }
        logger.info(`Password is valid for admin: ${admin.email}`);

        // Update last login date
        await Admin.findByIdAndUpdate(admin._id, { last_login_date: new Date() });

        const token = sign('ADMIN', admin.name, 'ADMIN');

        res.status(200).json({
            message: `Admin ${admin.name} logged in successfully`,
            token: token,
            data: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                mobile_no: admin.mobile_no,
                role: 'ADMIN'
            }
        });

    } catch (error) {
        logger.error(`Error logging in admin: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get admin by ID
async function getAdminById(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Getting admin by ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        const admin = await Admin.findById(id).select('-password -iv');
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.status(200).json({
            message: 'Admin retrieved successfully',
            data: admin
        });

    } catch (error) {
        logger.error(`Error getting admin by ID: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// UPDATE - Update admin
async function updateAdmin(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Updating admin ID: ${id}, payload: ${JSON.stringify(req.body)}`);

        if (!id) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        // Check if admin exists
        const existingAdmin = await Admin.findById(id);
        if (!existingAdmin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const {
            name,
            email,
            mobile_no,
            password
        } = req.body;

        // Check if email is being changed and if it already exists
        if (email && email !== existingAdmin.email) {
            const emailExists = await Admin.findOne({
                email,
                _id: { $ne: id }
            });
            if (emailExists) {
                return res.status(409).json({ message: 'Admin with this email already exists' });
            }
        }

        // Check if mobile number is being changed and if it already exists
        if (mobile_no && mobile_no !== existingAdmin.mobile_no) {
            const mobileExists = await Admin.findOne({
                mobile_no,
                _id: { $ne: id }
            });
            if (mobileExists) {
                return res.status(409).json({ message: 'Admin with this mobile number already exists' });
            }
        }

        // Prepare update payload
        const updatePayload = {};
        if (name) updatePayload.name = name;
        if (email) updatePayload.email = email;
        if (mobile_no) updatePayload.mobile_no = mobile_no;
        
        // Handle password update if provided
        if (password) {
            const { encrypted: encryptedPassword, iv: iv } = encrypt(password);
            updatePayload.password = encryptedPassword;
            updatePayload.iv = iv;
            updatePayload.password_changed_date = new Date();
        }

        const updatedAdmin = await Admin.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        ).select('-password -iv');

        res.status(200).json({
            message: 'Admin updated successfully',
            data: updatedAdmin
        });

    } catch (error) {
        logger.error(`Error updating admin: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// DELETE - Delete admin
async function deleteAdmin(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Deleting admin ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'Admin ID is required' });
        }

        // Check if admin exists
        const admin = await Admin.findById(id);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        await Admin.deleteOne({ _id: id });

        res.status(200).json({
            message: 'Admin deleted successfully'
        });

    } catch (error) {
        logger.error(`Error deleting admin: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}


// CHANGE PASSWORD - Change admin password
async function changeAdminPassword(req, res) {
    try {
        const { id } = req.query;
        const { current_password, new_password } = req.body;
        
        logger.info(`Changing password for admin ID: ${id}`);

        if (!id || !current_password || !new_password) {
            return res.status(400).json({ 
                message: 'Admin ID, current password, and new password are required' 
            });
        }

        const admin = await Admin.findById(id);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = current_password === decrypt(admin.password, admin.iv);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Encrypt new password
        const { encrypted: encryptedPassword, iv: iv } = encrypt(new_password);

        await Admin.findByIdAndUpdate(id, {
            password: encryptedPassword,
            iv: iv,
            password_changed_date: new Date()
        });

        logger.info(`Password changed successfully for admin: ${admin.email}`);

        res.status(200).json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        logger.error(`Error changing admin password: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    registerAdmin,
    loginAdmin,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    changeAdminPassword
};
