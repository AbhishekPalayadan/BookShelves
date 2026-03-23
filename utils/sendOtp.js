const nodemailer = require("nodemailer");

const sendOtp = async (email, otp) => {

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    }
});

const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to: email,
    subject: "Bookshelves OTP Verification",
    html: `
        <h2>Your OTP</h2>
        <p>Your verification OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
    `
};

await transporter.sendMail(mailOptions);

};

module.exports = sendOtp;