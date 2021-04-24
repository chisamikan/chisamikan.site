require('dotenv').config();

const nodemailer = require('nodemailer');

exports.handler = function (event, context, callback) {
  const { name, email, message } = JSON.parse(event.body).payload.data;

  console.log(user);

  let transporter = nodemailer.createTransport('SMTP', {
    service: 'hotmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log(event.body);

  let mailOptions = {
    from: `"千紗みかん"<${process.env.EMAIL_USER}>`,
    to: `${email}`,
    subject: 'ありがとうございます。フォームを送信いたしました',
    html: `${name}様　メッセージを送信しました。`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      callback(error);
    } else {
      callback(null, {
        statusCode: 200,
        body: 'Ok',
      });
    }
  });
};
