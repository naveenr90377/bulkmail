
const express = require("express")
const cors = require("cors")
require("dotenv").config()
const nodemailer = require("nodemailer")
const mongoose = require("mongoose")

const app = express()

app.use(cors())
app.use(express.json({ limit: "1mb" }))

const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGO_URI

// MongoDB campaign history schema
const HistorySchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    recipientCount: {
        type: Number,
        required: true
    },
    recipients: {
        type: [String],
        required: true
    },
    status: {
        type: String,
        enum: ["Success", "Failed", "Partial"],
        default: "Failed"
    },
    date: {
        type: Date,
        default: Date.now
    }
})

const EmailHistory = mongoose.model(
    "EmailHistory",
    HistorySchema,
    "email_history"
)

// Connect to MongoDB Atlas
mongoose.connect(MONGO_URI)
    .then(function () {
        console.log("Connected to MongoDB successfully")
    })
    .catch(function (error) {
        console.error("MongoDB connection error:", error.message)
    })

// Create Gmail transporter
function createTransporter() {
    const userEmail = process.env.SMTP_USER
    const userPass = process.env.SMTP_PASS

    if (!userEmail || !userPass) {
        throw new Error("SMTP_USER or SMTP_PASS is missing")
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: userEmail,
            pass: userPass
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000
    })
}

// API health check
app.get("/", function (req, res) {
    res.json({
        message: "Bulk Mail API is running"
    })
})

// Send bulk emails
app.post("/sendmail", async function (req, res) {
    const subject =
        typeof req.body.subject === "string"
            ? req.body.subject.trim()
            : ""

    const msg =
        typeof req.body.msg === "string"
            ? req.body.msg.trim()
            : ""

    const emailList = req.body.emailList

    // Validate input
    if (
        !subject ||
        !msg ||
        !Array.isArray(emailList) ||
        emailList.length === 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Subject, message, and recipients are required."
        })
    }

    // Validate, trim, and remove duplicate addresses
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    const recipients = [
        ...new Set(
            emailList
                .filter(function (email) {
                    return typeof email === "string"
                })
                .map(function (email) {
                    return email.trim()
                })
                .filter(function (email) {
                    return emailPattern.test(email)
                })
        )
    ]

    if (recipients.length === 0) {
        return res.status(400).json({
            success: false,
            message: "No valid email addresses were found."
        })
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            success: false,
            message: "Database is unavailable."
        })
    }

    let historyRecord
    let transporter

    try {
        // Record campaign before sending
        historyRecord = await EmailHistory.create({
            subject: subject,
            message: msg,
            recipientCount: recipients.length,
            recipients: recipients,
            status: "Failed"
        })

        transporter = createTransporter()

        // Check SMTP connection and credentials
        await transporter.verify()
        console.log("Gmail SMTP connection verified")

        let sentCount = 0
        const failedRecipients = []

        // Send each email and continue if one fails
        for (const email of recipients) {
            try {
                const info = await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: email,
                    subject: subject,
                    text: msg
                })

                const accepted = (info.accepted || []).map(
                    function (address) {
                        return String(address).toLowerCase()
                    }
                )

                if (accepted.includes(email.toLowerCase())) {
                    sentCount++
                    console.log("SMTP accepted email for:", email)
                } else {
                    failedRecipients.push(email)
                    console.error("SMTP did not accept:", email)
                }
            } catch (error) {
                failedRecipients.push(email)

                console.error("Email sending error:", {
                    recipient: email,
                    code: error.code,
                    responseCode: error.responseCode,
                    command: error.command,
                    message: error.message
                })
            }
        }

        // Determine campaign status
        let campaignStatus = "Failed"

        if (sentCount === recipients.length) {
            campaignStatus = "Success"
        } else if (sentCount > 0) {
            campaignStatus = "Partial"
        }

        // Update MongoDB history
        historyRecord.status = campaignStatus
        await historyRecord.save()

        const result = {
            success: campaignStatus === "Success",
            status: campaignStatus,
            message:
                campaignStatus === "Success"
                    ? "All emails were accepted by the mail server."
                    : campaignStatus === "Partial"
                    ? "Some emails were accepted, but others failed."
                    : "No emails were accepted by the mail server.",
            totalRecipients: recipients.length,
            sentCount: sentCount,
            failedCount: failedRecipients.length,
            failedRecipients: failedRecipients
        }

        if (campaignStatus === "Failed") {
            return res.status(502).json(result)
        }

        return res.status(200).json(result)
    } catch (error) {
        console.error("Bulk mail request failed:", {
            code: error.code,
            responseCode: error.responseCode,
            command: error.command,
            message: error.message
        })

        if (historyRecord) {
            try {
                historyRecord.status = "Failed"
                await historyRecord.save()
            } catch (historyError) {
                console.error(
                    "History update failed:",
                    historyError.message
                )
            }
        }

        return res.status(500).json({
            success: false,
            message: "Email operation failed. Check the backend logs."
        })
    } finally {
        if (transporter) {
            transporter.close()
        }
    }
})

// Fetch campaign history
app.get("/history", async function (req, res) {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            error: "Database is unavailable."
        })
    }

    try {
        const history = await EmailHistory
            .find()
            .sort({ date: -1 })
            .limit(100)

        return res.json(history)
    } catch (error) {
        console.error("History fetch error:", error.message)

        return res.status(500).json({
            error: "Failed to fetch campaign history."
        })
    }
})

app.listen(PORT, function () {
    console.log("Server started on port " + PORT)
})
