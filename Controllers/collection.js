import asyncHandler from "../middleware/asyncHandler.js";
import CamDetails from "../models/CAM.js";
import Closed from "../models/Closed.js";
import Disbursal from "../models/Disbursal.js";
import { postLogs } from "./logs.js";

// @desc Create a lead to close after collection/recovery
// @route POST /api/collections/
export const createActiveLead = async (pan, loanNo, leadNo) => {
    try {
        const existingActiveLead = await Closed.findOne({ pan: pan });
        if (!existingActiveLead) {
            const newActiveLead = await Closed.create({
                pan,
                data: [{ loanNo: loanNo, leadNo: leadNo }],
            });
            if (!newActiveLead) {
                return { success: false };
            }
            return { success: true };
        } else if (
            existingActiveLead.data.some((entry) => entry.isActive === false)
        ) {
            // If disbursal ID is not found, add the new disbursal
            existingActiveLead.data.push({ loanNo: loanNo, leadNo: leadNo });
            const res = await existingActiveLead.save();
            if (!res) {
                return { success: false };
            }
            return { success: true };
        } else {
            return { success: false };
        }
    } catch (error) {
        console.log(error);
    }
};

// @desc Get all active leads
// @route GET /api/collections/active
// @access Private
export const activeLeads = asyncHandler(async (req, res) => {
    if (req.activeRole === "collectionExecutive") {
        // const page = parseInt(req.query.page) || 1; // current page
        // const limit = parseInt(req.query.limit) || 10; // items per page
        // const skip = (page - 1) * limit;

        const pipeline = [
            {
                $match: {
                    // Match the parent document where the data array contains elements
                    // that have isActive: true
                    "data.isActive": true,
                    "data.isDisbursed": true,
                    "data.isClosed": false,
                },
            },
            {
                $project: {
                    pan: 1,
                    data: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$data",
                                    as: "item", // Alias for each element in the array
                                    cond: {
                                        $and: [
                                            { $eq: ["$$item.isActive", true] }, // Condition for isActive
                                            {
                                                $eq: [
                                                    "$$item.isDisbursed",
                                                    true,
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $sort: {
                    updatedAt: -1, // Sort by updatedAt in descending order
                },
            },
            // {
            //     $skip: skip,
            // },
            // {
            //     $limit: limit,
            // },
        ];

        // const results = await Closed.aggregate(pipeline);
        const activeLeads = await Closed.aggregate([
            {
                $match: {
                    data: {
                        $elemMatch: {
                            isActive: true,
                            isDisbursed: true,
                            isClosed: false,
                        },
                    },
                },
            },
            {
                $unwind: {
                    path: "$data",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $match: {
                    "data.isActive": true,
                    "data.isDisbursed": true,
                    "data.isClosed": false,
                },
            },
            {
                $lookup: {
                    from: "disbursals",
                    localField: "data.disbursal",
                    foreignField: "_id",
                    as: "data.disbursal",
                },
            },
            {
                $unwind: {
                    path: "$data.disbursal",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "data.disbursal.disbursedBy",
                    foreignField: "_id",
                    as: "data.disbursal.disbursedBy",
                },
            },
            {
                $unwind: {
                    path: "$data.disbursal.disbursedBy",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "leads",
                    localField: "data.leadNo",
                    foreignField: "leadNo",
                    as: "data.disbursal.lead",
                },
            },
            {
                $unwind: {
                    path: "$data.disbursal.lead",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "camdetails",
                    localField: "data.leadNo",
                    foreignField: "leadNo",
                    as: "data.camDetails",
                },
            },
            {
                $unwind: {
                    path: "$data.camDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $sort: { updatedAt: -1 },
            },
            {
                $project: {
                    _id: 1,
                    updatedAt: 1,

                    "data.leadNo": "$data.leadNo",
                    "data.loanNo": "$data.loanNo",

                    // Lead Fields (Corrected path)
                    "lead.fName": "$data.disbursal.lead.fName",
                    "lead.mName": "$data.disbursal.lead.mName",
                    "lead.lName": "$data.disbursal.lead.lName",
                    "lead.mobile": "$data.disbursal.lead.mobile",
                    "lead.aadhaar": "$data.disbursal.lead.aadhaar",
                    "lead.pan": "$data.disbursal.lead.pan",
                    "lead.city": "$data.disbursal.lead.city",
                    "lead.state": "$data.disbursal.lead.state",
                    "lead.source": "$data.disbursal.lead.source",

                    // CAM Details
                    "camDetails.loanRecommended":
                        "$data.camDetails.details.loanRecommended",
                    "camDetails.salary":
                        "$data.camDetails.details.actualNetSalary",

                    // Disbursed By Fields (Corrected path)
                    "disbursedBy.fName": "$data.disbursal.disbursedBy.fName",
                    "disbursedBy.lName": "$data.disbursal.disbursedBy.lName",
                },
            },
        ]);

        const totalActiveLeads = await Closed.countDocuments({
            "data.isActive": true,
        });

        res.json({
            totalActiveLeads,
            // totalPages: Math.ceil(totalActiveLeads / limit),
            // currentPage: page,
            activeLeads,
        });
    }
});

// @desc Get a specific active leads
// @route GET /api/collections/active/:loanNo
// @access Private
export const getActiveLead = asyncHandler(async (req, res) => {
    const { loanNo } = req.params;

    // const activeRecord = (await Closed.aggregate(pipeline))[0];
    const activeRecord = await Closed.findOne(
        { "data.loanNo": loanNo },
        {
            pan: 1,
            data: {
                $elemMatch: { loanNo: loanNo }, // Match only the specific loanNo
            },
        }
    ).populate({
        path: "data.disbursal",
        populate: [
            {
                path: "sanction", // Populating the 'sanction' field in Disbursal
                populate: [
                    { path: "approvedBy" },
                    {
                        path: "application",
                        populate: [
                            { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
                            { path: "creditManagerId" }, // Populate creditManagerId
                            { path: "recommendedBy" },
                        ],
                    },
                ],
            },
            { path: "disbursedBy", select: "fName lName" }, // ✅ Added this to populate disbursedBy
        ],
    });

    if (!activeRecord) {
        res.status(404);
        throw new Error({
            success: false,
            message: "Loan number not found.",
        });
    }

    // Fetch the CAM data and add to disbursalObj
    const cam = await CamDetails.findOne({
        leadId: activeRecord?.data?.[0]?.disbursal?.sanction?.application?.lead
            ._id,
    });

    const activeLeadObj = activeRecord.toObject();

    // Extract the matched data object from the array
    const matchedData = activeLeadObj.data[0]; // Since $elemMatch returns a single matching element
    matchedData.disbursal.sanction.application.cam = cam
        ? { ...cam.toObject() }
        : null;

    return res.json({
        pan: activeLeadObj.pan, // Include the parent fields
        data: matchedData, // Send the matched object as a single object
    });
});

// @desc Update an active lead after collection/recovery
// @route PATCH /api/collections/active/:loanNo
// @access Private
export const updateActiveLead = asyncHandler(async (req, res) => {
    if (req.activeRole === "collectionExecutive") {
        const { loanNo } = req.params;
        const updates = req.body;

        const pipeline = [
            {
                $match: { "data.loanNo": loanNo }, // Match documents where the data array contains the loanNo
            },
            {
                $project: {
                    data: {
                        $filter: {
                            input: "$data",
                            as: "item", // Alias for each element in the array
                            cond: { $eq: ["$$item.loanNo", loanNo] }, // Condition to match
                        },
                    },
                },
            },
        ];

        const activeRecord = (await Closed.aggregate(pipeline))[0];

        if (!activeRecord || !activeRecord.data?.length) {
            res.status(404);
            throw new Error({
                success: false,
                message: "Loan number not found.",
            });
        }

        // Populate the filtered data
        const populatedRecord = await Closed.populate(activeRecord, {
            path: "data.disbursal",
            populate: {
                path: "sanction", // Populating the 'sanction' field in Disbursal
                populate: [
                    { path: "approvedBy" },
                    {
                        path: "application",
                        populate: [
                            { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
                            { path: "creditManagerId" }, // Populate creditManagerId
                            { path: "recommendedBy" },
                        ],
                    },
                ],
            },
        });

        // Check if updates are provided
        if (updates && updates.data) {
            const updateQuery = {
                "data.loanNo": loanNo,
            };

            let updateOperation = {};

            if (updates.data.partialPaid) {
                // If partialPaid is present in the updates, push the object into the array
                updateOperation.$push = {
                    "data.$.partialPaid": updates.data.partialPaid,
                    "data.$.requestedStatus": updates.data.requestedStatus,
                };
            } else {
                updateOperation.$set = {
                    "data.$": { ...populatedRecord.data[0], ...updates.data }, // Merge updates
                };
            }

            const updatedRecord = await Closed.findOneAndUpdate(
                updateQuery,
                updateOperation,
                { new: true } // Return the updated document
            );

            if (updatedRecord) {
                return res.json({
                    success: true,
                    message: "Record updated successfully.",
                });
            } else {
                res.status(404);
                throw new Error("Unable to update the record.");
            }
        }
    }
    // If no updates or empty data, return a successful response with no changes
    return res.json({
        success: true,
        message: "No changes made. Record remains unchanged.",
    });
});

// @desc Get all the closed leads
// @route GET /api/collections/closed/
// @access Private
export const closedLeads = asyncHandler(async (req, res) => {
    // if (req.activeRole === "accountExecutive") {
    // const page = parseInt(req.query.page) || 1; // current page
    // const limit = parseInt(req.query.limit) || 10; // items per page
    // const skip = (page - 1) * limit;

    const closedLeads = await Closed.aggregate([
        { $unwind: "$data" }, // Flatten the data array

        // Match closed leads
        {
            $match: {
                "data.isActive": false,
                "data.isClosed": true,
            },
        },

        // Sort by updatedAt (latest first)
        { $sort: { "data.updatedAt": -1 } },

        // Lookup lead details using leadNo
        {
            $lookup: {
                from: "leads",
                localField: "data.leadNo",
                foreignField: "leadNo",
                as: "data.lead",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            fName: 1,
                            mName: 1,
                            lName: 1,
                            mobile: 1,
                            aadhaar: 1,
                            pan: 1,
                            city: 1,
                            state: 1,
                            source: 1,
                        },
                    },
                ],
            },
        },
        { $unwind: { path: "$data.lead", preserveNullAndEmptyArrays: true } },

        // Lookup camDetails using leadNo
        {
            $lookup: {
                from: "camdetails",
                localField: "data.leadNo",
                foreignField: "leadNo",
                as: "data.camDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            loanRecommended: "$details.loanRecommended",
                            actualNetSalary: "$details.actualNetSalary",
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$data.camDetails",
                preserveNullAndEmptyArrays: true,
            },
        }, // Convert array to object

        // Extract disbursedBy from disbursal (without projecting the whole disbursal object)
        {
            $lookup: {
                from: "disbursals",
                localField: "data.leadNo",
                foreignField: "leadNo",
                as: "data.disbursal",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            sanction: 1,
                            isRejected: 1,
                            disbursedBy: 1, // Only fetch disbursedBy field
                        },
                    },
                ],
            },
        },
        { $unwind: { path: "$disbursal", preserveNullAndEmptyArrays: true } },
        {
            $match: {
                // Assuming 'rejected' is a field in disbursal indicating rejection status
                "data.disbursal.isRejected": { $ne: true },
            },
        },
        {
            $lookup: {
                from: "sanctions",
                localField: "data.disbursal.sanction",
                foreignField: "_id",
                as: "data.disbursal.sanction",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            isRejected: 1,
                        },
                    },
                ],
            },
        },
        { $unwind: { path: "$sanction", preserveNullAndEmptyArrays: true } },
        {
            $match: {
                // Assuming 'rejected' is a field in sanction indicating rejection status
                "data.sanction.isRejected": { $ne: true },
            },
        },

        // Lookup employee details for disbursedBy
        {
            $lookup: {
                from: "employees",
                localField: "data.disbursal.disbursedBy",
                foreignField: "_id",
                as: "data.disbursal.disbursedBy",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            fName: 1, // Only fetch the employee name
                            lName: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$data.disbursal.disbursedBy",
                preserveNullAndEmptyArrays: true,
            },
        }, // Convert array to object

        // Make data the root document instead of wrapping inside closedLeads
        { $replaceRoot: { newRoot: "$data" } },
    ]);

    const totalClosedLeads = await Closed.countDocuments({
        "data.isActive": false,
        "data.isClosed": true,
    });

    res.json({
        totalClosedLeads,
        // totalPages: Math.ceil(totalClosedLeads / limit),
        // currentPage: page,
        closedLeads,
    });
    // }
});
