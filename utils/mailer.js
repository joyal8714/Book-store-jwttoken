const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendOTP(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your Email',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333;">Email Verification</h2>
        <p style="font-size: 16px; color: #555;">
          Thank you for registering. Please use the OTP below to verify your email:
        </p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="display: inline-block; background-color: #f0f8ff; color: #2c3e50; font-size: 28px; padding: 10px 20px; border-radius: 8px; letter-spacing: 4px; font-weight: bold; border: 2px dashed #3498db;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #999;">
          This OTP will expire in 10 minutes. Please do not share it with anyone.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendOTP;
