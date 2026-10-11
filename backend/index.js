const express = require("express");
const cors = require("cors");
require("dotenv").config();
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/bulkmail";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((err) => console.error("DB Connection Error:", err));

const HistorySchema = new mongoose.Schema({
    subject: String,
    message: String,
    recipientCount: Number,
    recipients: [String],
    status: String,
    date: { type: Date, default: Date.now }
});

const EmailHistory = mongoose.model("EmailHistory", HistorySchema, "email_history");

app.post("/sendmail", async function(req, res) {
    const { subject, msg, emailList } = req.body;

    const userEmail = process.env.SMTP_USER;
    const userPass = process.env.SMTP_PASS;

    if (!userEmail || !userPass) {
        console.log("Error: SMTP_USER or SMTP_PASS missing in environment variables");
        return res.send(false);
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
            console.log("Email sent successfully to: " + emailList[i]);
        }

        await EmailHistory.create({
            subject: subject,
            message: msg,
            recipientCount: emailList.length,
            recipients: emailList,
            status: "Success"
        });
        res.send(true);
    } catch (error) {
        console.log("Nodemailer Error Details:", error);

        await EmailHistory.create({
            subject: subject,
            message: msg,
            recipientCount: emailList.length,
            recipients: emailList,
            status: "Failed"
        });

        res.send(false);
    }
});

app.get("/history", async function(req, res) {
    try {
        const history = await EmailHistory.find().sort({ date: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// Railway dynamically assigns a port, so use process.env.PORT
const PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
    console.log(`Server started on port ${PORT}...`);
});