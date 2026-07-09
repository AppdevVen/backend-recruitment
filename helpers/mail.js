import {dbHris} from "../config/db.js";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config();

export const sendMail = async (data) => {
	try {
		let mailSender = await dbHris("ptl_apps")
						.join("ptl_mail_sender", "ptl_mail_sender.id", "ptl_apps.apps_sender")
						.select("ms_name","ms_pass","ms_host","ms_name_alias")
						.where("apps_slug", process.env.APP_FLAG)
						.first();
		// console.log(mailSender);
		if (!mailSender) {
			throw {
				message: "Data mail sender tidak tersedia",
			};
		}
		
		const transporter = nodemailer.createTransport({
			port: 587,
			host: mailSender.ms_host,
			auth: {
				user: mailSender.ms_name,
				pass: mailSender.ms_pass,
			},
			secure: false,
		});	
		
		let mailData;
        if (process.env.ENVIRONMENT == 'LOCAL'){
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} "LOCAL" <${mailSender.ms_name_alias}>`,
				to: process.env.MAIL_TO?process.env.MAIL_TO:data.to,
				cc: process.env.MAIL_CC?process.env.MAIL_CC:data.cc,
				bcc: data.bcc ? data.bcc : "",
				subject: data.subject,
				html: data.html,
			};
		}
		else if (process.env.ENVIRONMENT == 'DEV'){
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} "DEV" <${mailSender.ms_name_alias}>`,
				to: process.env.MAIL_TO?process.env.MAIL_TO:data.to,
				cc: process.env.MAIL_CC?process.env.MAIL_CC:data.cc,
				bcc: data.bcc ? data.bcc : "",
				subject: data.subject,
				html: data.html,
			};
		}
		else if (process.env.ENVIRONMENT == 'TEST'){
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} "TEST" <${mailSender.ms_name_alias}>`,
				to: process.env.MAIL_TO?process.env.MAIL_TO:data.to,
				cc: process.env.MAIL_CC?process.env.MAIL_CC:data.cc,
				bcc: data.bcc ? data.bcc : "",
				subject: data.subject,
				html: data.html,
			};
		}
		else {
			mailData = {
				//from: data.from,
				from: `${process.env.APP_ALIAS} <${mailSender.ms_name_alias}>`,
				to: data.to,
				cc: data.cc ? data.cc : "",
				bcc: data.bcc ? data.bcc : "",
				subject: data.subject,
				html: data.html,
			};
		}

		await transporter.sendMail(mailData);
	} catch (error) {
		throw error;
	}
};