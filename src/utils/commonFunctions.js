const GroupTransaction = require('../models/group_transaction.model');
const logger = require('../../logger');
const { ObjectId } = require('mongoose').Types;

async function saveGroupTransaction(gtPayload) {
    return new Promise(async (resolve, reject) => {
        try {
            logger.info('Payload to save transaction ', gtPayload);
            const groupTransaction = new GroupTransaction({
                shg_group_id: gtPayload.shg_group_id,
                member_id: gtPayload.member_id,
                amount: gtPayload.amount,
                flow_type: gtPayload.flow_type,
                transaction_type: gtPayload.transaction_type,
                reference_model: gtPayload.reference_model,
                reference_id: gtPayload.reference_id,
                is_group_activity: gtPayload.is_group_activity,
                notes: gtPayload.notes,
                created_by_id: gtPayload.created_by_id
            })
            await groupTransaction.save();
            logger.info('Group transaction saved successfully ',groupTransaction);
            resolve(groupTransaction);
        } catch (error) {
            logger.error('Error in getGroupTransaction:', error);
            reject(error);
        }
    })
}

async function getCurrentBalanceByShgGroupId(shg_group_id) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!shg_group_id) {
                throw new Error('shg_group_id is required');
            }

            logger.info('Fetching current balance for shg_group_id:', shg_group_id);

            const transactionData = await GroupTransaction.aggregate([
                {
                    $match: {
                        shg_group_id: new ObjectId(shg_group_id)
                    }
                },
                {
                    $group: {
                        _id: "$flow_type",
                        total_amount: { $sum: "$amount" }
                    }
                }
            ]);

            let totalInflow = 0;
            let totalOutflow = 0;

            for (const trans of transactionData) {
                if (trans._id === 'in') {
                    totalInflow += trans.total_amount;
                } else if (trans._id === 'out') {
                    totalOutflow += trans.total_amount;
                }
            }

            const currentBalance = totalInflow - totalOutflow;

            logger.info('Current balance calculated successfully:', {
                shg_group_id,
                totalInflow,
                totalOutflow,
                currentBalance
            });

            resolve({
                shg_group_id,
                total_inflow: totalInflow,
                total_outflow: totalOutflow,
                current_balance: currentBalance
            });
        } catch (error) {
            logger.error('Error in getCurrentBalanceByShgGroupId:', error);
            reject(error);
        }
    });
}

module.exports = {
    saveGroupTransaction,
    getCurrentBalanceByShgGroupId
}