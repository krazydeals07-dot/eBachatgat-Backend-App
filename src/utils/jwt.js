const jwt = require('jsonwebtoken');

const secretKey = process.env.JWT_SECRET || 'defaultSecretKey'; // Use a secret key from environment variables

const authentication = {
    sign: (shg_code, name, role) => {
        const payload = { shg_code, name, role };
        return jwt.sign(payload, secretKey, { expiresIn: process.env.JWT_EXPIRATION || '48h' }); // Set expiration time from environment variables
    },

    // Function to verify a JWT token
    verify: async (req, res, next) => {
        try {
            const token = req.headers['authorization']?.split(' ')?.[1] || ""; // Get token from Authorization header
            console.log('Token:', token);

            if (!token) {
                return res.status(401).json({ message: 'Authorization token is required' });
            }

            try {
                await jwt.verify(token, secretKey); // Verify the token
                next();
            } catch (error) {
                return res.status(401).json({ message: 'Invalid or expired token' });
            }
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    },

    // Function to create token for forgot password
    forgotPassword: (shg_code, shg_group_secret) => {
        return jwt.sign({ shg_code, shg_group_secret }, secretKey, { expiresIn: process.env.JWT_EXPIRATION || '10m' });
    },

    // Function to verify token for forgot password
    verifyPassword: async (token) => {
        try {
            const decoded = await jwt.verify(token, secretKey);
            return decoded;
        } catch (error) {
            return false;
        }
    }
};

module.exports = authentication;
