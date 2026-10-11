app.post("/sendmail", async function(req, res) {
    const { subject, msg, emailList } = req.body

    const userEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER; // Your Gmail address
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const refreshToken = process.env.REFRESH_TOKEN;

    if (!userEmail || !clientId || !clientSecret || !refreshToken) {
        console.log("Error: Missing Google OAuth environment variables")
        return res.send(false)
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: userEmail,
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: refreshToken
        }
    })

    try {
        for (let i = 0; i < emailList.length; i++) {
            await transporter.sendMail({
                from: userEmail,
                to: emailList[i],
                subject: subject || "Bulk Notification",
                text: msg
            })
            console.log("Email sent successfully to: " + emailList[i])
        }

        await EmailHistory.create({
            subject: subject,
            message: msg,
            recipientCount: emailList.length,
            recipients: emailList,
            status: "Success"
        })
        res.send(true)
    } catch (error) {
        console.log("Nodemailer Error Details:", error)

        await EmailHistory.create({
            subject: subject,
            message: msg,
            recipientCount: emailList.length,
            recipients: emailList,
            status: "Failed"
        })

        res.send(false)
    }
})