const { put } = require('@vercel/blob');
const logger = require('../../logger');

const uploadFile = async (path, file) => {
    logger.info('Uploading file:', path);
    const blob = await put(path, file.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true
    }).catch((error) => {
        logger.error('Error uploading file:', error);
        return null;
    });
    return blob.url;
};

module.exports = uploadFile;