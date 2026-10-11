const nodemailer = require("nodemailer");

export default async function handler(req, res) {
    // Enable CORS for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { subject, msg, emailList } = req.body;

    const userEmail = process.env.SMTP_USER;
    const userPass = process.env.SMTP_PASS;

    if (!userEmail || !userPass) {
        console.log("Error: SMTP credentials missing");
        return res.status(500).json({ success: false, error: "SMTP credentials missing" });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: userEmail,
            pass: userPass
        }
    });

    try {
        for (let i = 0; i < emailList.length; i++) {
            await transporter.sendMail({
                from: userEmail,
                to: emailList[i],
                subject: subject || "Bulk Notification",
                text: msg
            });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Nodemailer Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}