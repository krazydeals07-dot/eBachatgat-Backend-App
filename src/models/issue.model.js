const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const issueSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: [true, 'SHG Group ID is required'],
            index: true
        },
        member_id: {
            type: ObjectId,
            ref: 'user',
            required: [true, 'Member ID is required'],
            index: true
        },
        desc: {
            type: String,
            required: [true, 'Issue description is required'],
            trim: true,
            minlength: [10, 'Description must be at least 10 characters long'],
            maxlength: [1000, 'Description cannot exceed 1000 characters']
        },
        severity: {
            type: String,
            required: [true, 'Severity is required'],
            enum: {
                values: ['major', 'minor', 'moderate'],
                message: 'Severity must be one of: major, minor, moderate'
            },
            lowercase: true
        },
        status: {
            type: String,
            required: [true, 'Status is required'],
            enum: {
                values: ['active', 'closed'],
                message: 'Status must be one of: active, closed'
            },
            default: 'active',
            lowercase: true
        },
        resolved_date: {
            type: Date,
            default: null
        },
        resolution_notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Resolution notes cannot exceed 500 characters']
        },
        image: {
            type: String,
            trim: true,
            maxlength: [2000, 'Image URL cannot exceed 2000 characters']
        }
    },
    {
        timestamps: true
    }
);

// Compound indexes for better query performance
issueSchema.index({ shg_group_id: 1, status: 1 });
issueSchema.index({ member_id: 1, status: 1 });
issueSchema.index({ severity: 1, status: 1 });

// Pre-save middleware to handle status changes
issueSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'closed' && !this.resolved_date) {
        this.resolved_date = new Date();
    }
    
    if (this.isModified('status') && this.status === 'active') {
        this.resolved_date = null;
        this.resolution_notes = null;
    }
    
    next();
});

// Virtual for issue age in days
issueSchema.virtual('ageInDays').get(function() {
    if (this.status === 'closed' && this.resolved_date) {
        return Math.ceil((this.resolved_date - this.createdAt) / (1000 * 60 * 60 * 24));
    }
    return Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Ensure virtual fields are serialized
issueSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('issue', issueSchema);
