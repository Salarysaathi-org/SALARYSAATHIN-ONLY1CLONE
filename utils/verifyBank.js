import axios from "axios";

// export const verifyBank = async (beneficiaryName, bankAccNo, ifscCode) => {
//     try {
//         let data = {
//             accNo: `${bankAccNo}`,
//             ifsc: `${ifscCode}`,
//             benificiaryName: `${beneficiaryName}`,
//         };

//         const response = await axios.post(
//             "https://api.digitap.ai/penny-drop/v2/check-valid",
//             data,
//             {
//                 headers: {
//                     Authorization: process.env.DIGITAP_AUTH_KEY,
//                     "Content-type": "application/json",
//                 },
//             }
//         );

//         if (response.data.model.status === "SUCCESS") {
//             return { success: true };
//         }

//         return { success: false, message: "Bank couldn't be verified!!" };
//     } catch (error) {
//         console.log({ status: error.status, message: error.message });
//         return { status: error.status, success: false, message: error.message };
//     }
// };

export const verifyBank = async (bankAccNo, ifscCode) => {
    try {
        let data = {
            accountNumber: `${bankAccNo}`,
            ifsc: `${ifscCode}`,
        };

        const response = await axios.post(
            "https://sm-kyc-sync-prod.scoreme.in/kyc/external/bankAccountVerification",
            data,
            {
                headers: {
                    ClientId: process.env.SCOREME_CLIENT_ID,
                    ClientSecret: process.env.SCOREME_CLIENT_SECRET,
                    "Content-type": "application/json",
                },
            }
        );
        console.log(response.data);

        if (response.data.responseCode === "SRC001") {
            return { success: true };
        }

        return { success: false, message: "Bank couldn't be verified!!" };
    } catch (error) {
        console.log({ status: error.status, message: error.response.data });
        return { status: error.status, success: false, message: error.message };
    }
};
