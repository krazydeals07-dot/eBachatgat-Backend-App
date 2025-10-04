const GovtSchemes = require('../models/govt_schemes.model');
const logger = require('../../logger');
const { GOVT_SCHEMES_LANG } = require('../assets/constants.json');

// CREATE - Add new government scheme
async function createGovtScheme(req, res) {
    try {
        logger.info(`Creating government scheme payload: ${JSON.stringify(req.body)}`);
        const {
            scheme_name,
            details,
            benefits,
            eligibility,
            application_process,
            documents_required,
            clear_source_of_information,
            disclaimer,
            lang = null
        } = req.body;

        // Validation for required fields
        if (!scheme_name || !details || !clear_source_of_information || !disclaimer || !lang) {
            return res.status(400).json({
                message: 'Required fields are: scheme_name, details, clear_source_of_information, disclaimer, lang'
            });
        }

        if (!GOVT_SCHEMES_LANG.ARRAY.includes(lang)) {
            return res.status(400).json({ message: `lang must be one of: ${GOVT_SCHEMES_LANG.ARRAY.join(', ')}` });
        }

        // Check if scheme with same name already exists
        const existingScheme = await GovtSchemes.findOne({ scheme_name });
        if (existingScheme) {
            return res.status(409).json({ message: 'Government scheme with this name already exists' });
        }

        const schemePayload = {
            scheme_name,
            details,
            benefits,
            eligibility,
            application_process,
            documents_required,
            clear_source_of_information,
            disclaimer,
            lang
        };

        logger.info(`Government scheme payload: ${JSON.stringify(schemePayload)}`);

        const scheme = new GovtSchemes(schemePayload);
        await scheme.save();

        res.status(201).json({
            message: 'Government scheme created successfully',
            data: scheme
        });

    } catch (error) {
        logger.error(`Error creating government scheme: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get government scheme by ID
async function getGovtSchemeById(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Getting government scheme by ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'Scheme ID is required' });
        }

        const scheme = await GovtSchemes.findById(id);
        if (!scheme) {
            return res.status(404).json({ message: 'Government scheme not found' });
        }

        res.status(200).json({
            message: 'Government scheme retrieved successfully',
            data: scheme
        });

    } catch (error) {
        logger.error(`Error getting government scheme by ID: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get all government schemes
async function getAllGovtSchemes(req, res) {
    try {
        const { lang = "en" } = req.query;
        logger.info("payload : ", req.query);

        if (!lang) {
            return res.status(400).json({ message: 'Language is required' });
        }

        if (!GOVT_SCHEMES_LANG.ARRAY.includes(lang)) {
            return res.status(400).json({ message: `Language must be one of: ${GOVT_SCHEMES_LANG.ARRAY.join(', ')}` });
        }

        logger.info('Getting all government schemes');

        const schemes = await GovtSchemes.find({ lang }).sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Government schemes retrieved successfully',
            count: schemes.length,
            data: schemes
        });

    } catch (error) {
        logger.error(`Error getting all government schemes: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Search government schemes by name
async function searchGovtSchemes(req, res) {
    try {
        const { search_term } = req.query;
        logger.info(`Searching government schemes with term: ${search_term}`);

        if (!search_term) {
            return res.status(400).json({ message: 'Search term is required' });
        }

        const schemes = await GovtSchemes.find({
            $or: [
                { scheme_name: { $regex: search_term, $options: 'i' } },
                { details: { $regex: search_term, $options: 'i' } },
                { benefits: { $regex: search_term, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Government schemes search completed successfully',
            count: schemes.length,
            data: schemes
        });

    } catch (error) {
        logger.error(`Error searching government schemes: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// UPDATE - Update government scheme
async function updateGovtScheme(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Updating government scheme ID: ${id}, payload: ${JSON.stringify(req.body)}`);

        if (!id) {
            return res.status(400).json({ message: 'Scheme ID is required' });
        }

        // Check if scheme exists
        const existingScheme = await GovtSchemes.findById(id);
        if (!existingScheme) {
            return res.status(404).json({ message: 'Government scheme not found' });
        }

        const {
            scheme_name,
            details,
            benefits,
            eligibility,
            application_process,
            documents_required,
            clear_source_of_information,
            disclaimer,
            lang
        } = req.body;

        // Check if scheme name is being changed and if it already exists
        if (scheme_name && scheme_name !== existingScheme.scheme_name) {
            const nameExists = await GovtSchemes.findOne({
                scheme_name,
                _id: { $ne: id }
            });
            if (nameExists) {
                return res.status(409).json({ message: 'Government scheme with this name already exists' });
            }
        }

        // Prepare update payload
        const updatePayload = {};
        if (scheme_name) updatePayload.scheme_name = scheme_name;
        if (details) updatePayload.details = details;
        if (benefits) updatePayload.benefits = benefits;
        if (eligibility) updatePayload.eligibility = eligibility;
        if (application_process) updatePayload.application_process = application_process;
        if (documents_required) updatePayload.documents_required = documents_required;
        if (clear_source_of_information) updatePayload.clear_source_of_information = clear_source_of_information;
        if (disclaimer) updatePayload.disclaimer = disclaimer;
        if (lang) updatePayload.lang = lang;

        if (!GOVT_SCHEMES_LANG.ARRAY.includes(lang)) {
            return res.status(400).json({ message: `lang must be one of: ${GOVT_SCHEMES_LANG.ARRAY.join(', ')}` });
        }

        const updatedScheme = await GovtSchemes.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: 'Government scheme updated successfully',
            data: updatedScheme
        });

    } catch (error) {
        logger.error(`Error updating government scheme: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// DELETE - Delete government scheme
async function deleteGovtScheme(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Deleting government scheme ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'Scheme ID is required' });
        }

        // Check if scheme exists
        const scheme = await GovtSchemes.findById(id);
        if (!scheme) {
            return res.status(404).json({ message: 'Government scheme not found' });
        }

        await GovtSchemes.deleteOne({ _id: id });

        res.status(200).json({
            message: 'Government scheme deleted successfully'
        });

    } catch (error) {
        logger.error(`Error deleting government scheme: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

const getCountByLang = async (req, res) => {
    try {
        const totalCt = await GovtSchemes.countDocuments();

        const data = await GovtSchemes.aggregate([
            {
                $group: {
                    _id: "$lang",
                    count: { $sum: 1 }
                }
            }
        ])
        res.status(200).json({ totalCt, data });
    }
    catch (error) {
        logger.error(`Error getting count by lang: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    createGovtScheme,
    getGovtSchemeById,
    getAllGovtSchemes,
    searchGovtSchemes,
    updateGovtScheme,
    deleteGovtScheme,
    getCountByLang
};
