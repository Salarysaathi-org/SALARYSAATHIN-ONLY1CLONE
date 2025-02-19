import axios from "axios";

async function sendEmail(recipientName, subject, recipient, link) {
    try {
        const options = {
            method: "POST",
            url: "https://api.zeptomail.in/v1.1/email",
            headers: {
                accept: "application/json",
                authorization: `Zoho-enczapikey ${process.env.ZOHO_APIKEY}`,
                "cache-control": "no-cache",
                "content-type": "application/json",
            },
            data: JSON.stringify({
                from: { address: "info@salarysaathi.com" },
                to: [
                    {
                        email_address: {
                            address: recipient,
                            name: recipientName,
                        },
                    },
                ],
                subject: subject,
                htmlbody: `<p>To verify your aadhaar click on <strong>${link}</strong>.</p>`,
            }),
        };

        // const options = {
        //     method: "POST",
        //     url: "https://api.mailgun.net/v3/salarysaathi.com/messages",
        //     data: formData,
        //     headers: {
        //         accept: "application/json",
        //         authorization: `Basic ${process.env.MAILGUN_AUTH}`,
        //         ...formData.getHeaders(),
        //     },
        // };

        const response = await axios(options);

        return response.data;
    } catch (error) {
        console.log(error);
        throw new Error("Error sending email", error.message);
    }
}

export default sendEmail;
