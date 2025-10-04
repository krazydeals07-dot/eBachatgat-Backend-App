const express = require('express');
const router = express.Router();
const { 
    createGovtScheme, 
    getGovtSchemeById, 
    getAllGovtSchemes, 
    searchGovtSchemes, 
    updateGovtScheme, 
    deleteGovtScheme,
    getCountByLang
} = require('../controllers/govt_schemes.controller');
const { verify } = require('../utils/jwt');

// Public routes (no authentication required)
router.get('/get_all_schemes', getAllGovtSchemes);
router.get('/search_schemes', searchGovtSchemes);

// Protected routes (authentication required)
router.post('/create_scheme', verify, createGovtScheme);
router.get('/get_scheme_by_id', verify, getGovtSchemeById);
router.put('/update_scheme', verify, updateGovtScheme);
router.delete('/delete_scheme', verify, deleteGovtScheme);
router.get('/get_count_by_lang', verify, getCountByLang);

module.exports = router;
