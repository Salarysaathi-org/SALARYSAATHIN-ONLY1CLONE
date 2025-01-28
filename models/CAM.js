import mongoose from "mongoose";

const camSchema = new mongoose.Schema(
    {
        leadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },
        leadNo: {
            type: String,
            required: true,
        },
        details: {
            type: Object,
            required: true,
        },
    },
    { timestamps: true }
);

const CamDetails = mongoose.model("CamDetail", camSchema);
export default CamDetails;
