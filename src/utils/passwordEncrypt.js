require('dotenv').config();
const crypto = require('crypto');

function encrypt(password) {
    try {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error('ENCRYPTION_KEY environment variable is not set');
        }
                
        // Ensure key is exactly 32 bytes for AES-256-CBC
        let keyBuffer;
        if (key.length === 44) {
            // If it's base64 encoded, decode it
            keyBuffer = Buffer.from(key, 'base64');
        } else {
            // If it's a raw string, hash it to get 32 bytes
            keyBuffer = crypto.createHash('sha256').update(key).digest();
        }
        
        if (keyBuffer.length !== 32) {
            throw new Error(`Invalid key length: ${keyBuffer.length} bytes. Expected 32 bytes for AES-256-CBC`);
        }

        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
        
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

function decrypt(encrypted, iv) {
    try {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error('ENCRYPTION_KEY environment variable is not set');
        }
        
        // Ensure key is exactly 32 bytes for AES-256-CBC
        let keyBuffer;
        if (key.length === 44) {
            // If it's base64 encoded, decode it
            keyBuffer = Buffer.from(key, 'base64');
        } else {
            // If it's a raw string, hash it to get 32 bytes
            keyBuffer = crypto.createHash('sha256').update(key).digest();
        }
        
        if (keyBuffer.length !== 32) {
            throw new Error(`Invalid key length: ${keyBuffer.length} bytes. Expected 32 bytes for AES-256-CBC`);
        }
        
        const ivBuffer = Buffer.from(iv, 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

module.exports = {
    encrypt,
    decrypt
};