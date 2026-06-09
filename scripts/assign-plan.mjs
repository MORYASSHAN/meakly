import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import readline from 'node:readline';

// Initialize env variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const AUTH_DB = process.env.AUTH_DB_NAME || 'coldmailai_auth';
const USERS_DB = process.env.USER_DB_NAME || 'coldmailai_users';
const USAGE_DB = process.env.USAGE_DB_NAME || 'coldmailai_usage';
const BILLING_DB = process.env.BILLING_DB_NAME || 'coldmailai_billing';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

function getMailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const isMock = process.env.MOCK_GMAIL === 'true' || !user || !pass;

  if (isMock) {
    return {
      sendMail: async (options) => {
        console.log('\n--- [MOCK EMAIL SENT] ---');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Content:\n${options.text || options.html}`);
        console.log('-------------------------\n');
        return { messageId: 'mock_message_id' };
      },
    };
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function run() {
  console.log('Connecting to MongoDB...');
  // Create connections to the databases
  const authConn = await mongoose.createConnection(`${MONGO_URI}/${AUTH_DB}`).asPromise();
  const usersConn = await mongoose.createConnection(`${MONGO_URI}/${USERS_DB}`).asPromise();
  const usageConn = await mongoose.createConnection(`${MONGO_URI}/${USAGE_DB}`).asPromise();
  const billingConn = await mongoose.createConnection(`${MONGO_URI}/${BILLING_DB}`).asPromise();
  console.log('Connected to all databases successfully.\n');

  // Define schemas
  const AuthUser = authConn.model('AuthUser', new mongoose.Schema({
    email: String,
    name: String,
    plan: String,
  }, { strict: false }), 'authusers');

  const Profile = usersConn.model('UserProfile', new mongoose.Schema({
    userId: String,
    email: String,
    name: String,
    plan: String,
    monthlyLimit: Number,
  }, { strict: false }), 'userprofiles');

  const UsageBucket = usageConn.model('UsageBucket', new mongoose.Schema({
    userId: String,
    email: String,
    plan: String,
    limit: Number,
  }, { strict: false }), 'usagebuckets');

  const BillingSubscription = billingConn.model('BillingSubscription', new mongoose.Schema({
    userId: String,
    email: String,
    plan: String,
    status: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
  }, { strict: false }), 'billingsubscriptions');

  const mailer = getMailer();

  while (true) {
    console.log('==============================================');
    console.log('         ColdMail AI Plan Manager CLI         ');
    console.log('==============================================');
    console.log('1. List users pending activation & active paid users');
    console.log('2. Activate/Assign Pro Plan to user (Manual Upgrade)');
    console.log('3. Deactivate/Reset user to Free Plan');
    console.log('4. Send Day 3 Follow-up Email');
    console.log('5. Send Day 25-28 Renewal Reminder Email');
    console.log('6. Exit');
    console.log('==============================================');
    
    const choice = await askQuestion('Choose an option (1-6): ');
    
    if (choice === '1') {
      // List all users in billing
      const subscriptions = await BillingSubscription.find({});
      console.log('\n--- Tracking Sheet & Status Info ---');
      console.log('NAME\tEMAIL\tPLAN\tSTATUS\tACTIVATION DATE\tRENEWAL DATE');
      console.log('------------------------------------------------------------------------');
      for (const sub of subscriptions) {
        // Find corresponding user in auth to get their name
        const authUser = await AuthUser.findOne({ email: sub.email });
        const name = authUser?.name || 'N/A';
        const start = sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString() : 'N/A';
        const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A';
        console.log(`${name}\t${sub.email}\t${sub.plan}\t${sub.status}\t${start}\t${end}`);
      }
      console.log('\nCopyable CSV/Spreadsheet Row Template:');
      console.log('Name,Email,Payment Date,Access Given?,Renewal Date');
      for (const sub of subscriptions) {
        const authUser = await AuthUser.findOne({ email: sub.email });
        const name = authUser?.name || 'N/A';
        const paymentDate = sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toISOString().split('T')[0] : 'N/A';
        const renewalDate = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString().split('T')[0] : 'N/A';
        console.log(`"${name}","${sub.email}",${paymentDate},${sub.status === 'active' ? 'YES' : 'NO'},${renewalDate}`);
      }
      console.log('------------------------------------------------------------------------\n');
    }
    else if (choice === '2') {
      const email = (await askQuestion('Enter user email: ')).trim().toLowerCase();
      const user = await AuthUser.findOne({ email });
      if (!user) {
        console.log(`User with email "${email}" not found in auth database.\n`);
        continue;
      }

      console.log(`Found User: ${user.name} (${user.email}), current plan: ${user.plan || 'free'}`);
      const confirm = await askQuestion('Activate Pro Plan ($49/month) for this user? (y/n): ');
      if (confirm.toLowerCase() === 'y') {
        const userId = user._id.toString();
        const now = new Date();
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(now.getMonth() + 1);

        // 1. Auth service User
        await AuthUser.updateOne({ _id: user._id }, { $set: { plan: 'pro' } });

        // 2. User service Profile
        await Profile.updateOne({ userId }, { 
          $set: { 
            plan: 'pro',
            monthlyLimit: Number.MAX_SAFE_INTEGER 
          } 
        });

        // 3. Usage service UsageBucket
        await UsageBucket.updateOne({ userId }, { 
          $set: { 
            plan: 'pro',
            limit: Number.MAX_SAFE_INTEGER 
          } 
        });

        // 4. Billing service BillingSubscription
        await BillingSubscription.updateOne({ userId }, {
          $set: {
            userId,
            email: user.email,
            plan: 'pro',
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: oneMonthLater,
          }
        }, { upsert: true });

        console.log(`Successfully activated Pro Plan for ${user.email} in all services.`);

        // Send access granted email
        const loginLink = process.env.GATEWAY_URL || 'http://localhost:5173/login';
        try {
          await mailer.sendMail({
            from: `ColdMailAI <${process.env.GMAIL_USER || 'meaklystartup@gmail.com'}>`,
            to: user.email,
            subject: 'Access Granted: Your ColdMail AI Pro account is active!',
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #10b981; margin-bottom: 20px;">Welcome to ColdMail AI Pro!</h2>
                <p>Hello ${user.name},</p>
                <p>We are excited to let you know that your <strong>ColdMail AI Pro</strong> access has been manually verified and activated!</p>
                <p>Your subscription is active, giving you <strong>Unlimited AI email generations</strong> and priority dedicated support.</p>
                
                <h3 style="color: #4f46e5; margin-top: 25px;">Getting Started (Next Step):</h3>
                <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin-bottom: 20px; border-radius: 0 4px 4px 0;">
                  <strong>Create your first Campaign:</strong> Log in and navigate to the generate page to generate high-performing outreach emails using our advanced AI templates.
                </div>

                <p style="margin-bottom: 25px;">
                  <a href="${loginLink}" style="background-color: #4f46e5; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Log in to ColdMail AI</a>
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.875rem; color: #666;">
                  <p>Have questions? Simply reply to this email, and we will get back to you immediately.</p>
                  <p>Best regards,<br/>The ColdMail AI Team</p>
                </div>
              </div>
            `,
            text: `Hello ${user.name},\n\nYour ColdMail AI Pro access has been activated!\n\nLog in here: ${loginLink}\n\nClear Next Step: Create your first Campaign on the generate page to generate high-performing outreach emails.\n\nBest regards,\nColdMail AI Team`,
          });
          console.log(`Access granted email sent to ${user.email}.`);
        } catch (emailErr) {
          console.error(`Failed to send email to ${user.email}:`, emailErr.message);
        }
      }
      console.log('\n');
    }
    else if (choice === '3') {
      const email = (await askQuestion('Enter user email: ')).trim().toLowerCase();
      const user = await AuthUser.findOne({ email });
      if (!user) {
        console.log(`User with email "${email}" not found.\n`);
        continue;
      }

      const confirm = await askQuestion(`Reset ${user.name} to Free Plan? (y/n): `);
      if (confirm.toLowerCase() === 'y') {
        const userId = user._id.toString();

        await AuthUser.updateOne({ _id: user._id }, { $set: { plan: 'free' } });
        await Profile.updateOne({ userId }, { $set: { plan: 'free', monthlyLimit: 50 } });
        await UsageBucket.updateOne({ userId }, { $set: { plan: 'free', limit: 50 } });
        await BillingSubscription.updateOne({ userId }, { $set: { plan: 'free', status: 'inactive' } });

        console.log(`Successfully reset ${user.email} to Free plan across all services.\n`);
      }
    }
    else if (choice === '4') {
      const email = (await askQuestion('Enter user email for Day 3 Follow-up: ')).trim().toLowerCase();
      const user = await AuthUser.findOne({ email });
      if (!user) {
        console.log(`User with email "${email}" not found.\n`);
        continue;
      }

      try {
        await mailer.sendMail({
          from: `ColdMailAI <${process.env.GMAIL_USER || 'meaklystartup@gmail.com'}>`,
          to: user.email,
          subject: 'How is your outreach going? (ColdMail AI check-in)',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <p>Hi ${user.name},</p>
              <p>I wanted to check in and see how everything is going with your ColdMail AI account. Are you finding it easy to set up your outreach campaigns and generate emails?</p>
              <p>If you've run into any roadblocks or have feedback on how we can improve, please let me know. I'd love to help you get the best possible results.</p>
              <p>Just reply directly to this email if you need anything at all!</p>
              <br/>
              <p>Best regards,<br/>Shaan Goswami<br/>Founder, ColdMail AI</p>
            </div>
          `,
          text: `Hi ${user.name},\n\nI wanted to check in and see how everything is going with your ColdMail AI account. Are you finding it easy to set up your outreach campaigns and generate emails?\n\nIf you've run into any roadblocks, please reply directly to this email!\n\nBest regards,\nShaan Goswami\nFounder, ColdMail AI`,
        });
        console.log(`Day 3 follow-up email sent to ${user.email}.\n`);
      } catch (emailErr) {
        console.error(`Failed to send follow-up:`, emailErr.message);
      }
    }
    else if (choice === '5') {
      const email = (await askQuestion('Enter user email for Renewal Reminder: ')).trim().toLowerCase();
      const user = await AuthUser.findOne({ email });
      if (!user) {
        console.log(`User with email "${email}" not found.\n`);
        continue;
      }

      try {
        await mailer.sendMail({
          from: `ColdMailAI <${process.env.GMAIL_USER || 'meaklystartup@gmail.com'}>`,
          to: user.email,
          subject: 'Your ColdMail AI Pro renewal is coming up',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <p>Hi ${user.name},</p>
              <p>We hope you are enjoying your unlimited cold email generations with ColdMail AI Pro!</p>
              <p>This is a quick reminder that your subscription renewal is coming up in a few days. To maintain uninterrupted access to the Pro features, please reply to this email or send payment of <strong>$49</strong> to continue for the next month.</p>
              <p>Thank you for being a part of ColdMail AI!</p>
              <br/>
              <p>Best regards,<br/>The ColdMail AI Team</p>
            </div>
          `,
          text: `Hi ${user.name},\n\nThis is a quick reminder that your ColdMail AI Pro subscription renewal is coming up in a few days. To maintain uninterrupted access, please reply to this email or send payment of $49 to continue for the next month.\n\nThank you for being a part of ColdMail AI!\n\nBest regards,\nColdMail AI Team`,
        });
        console.log(`Renewal reminder email sent to ${user.email}.\n`);
      } catch (emailErr) {
        console.error(`Failed to send renewal reminder:`, emailErr.message);
      }
    }
    else if (choice === '6') {
      console.log('Exiting Plan Manager CLI. Goodbye!');
      break;
    }
    else {
      console.log('Invalid option. Please choose between 1 and 6.\n');
    }
  }

  // Close connections
  await authConn.close();
  await usersConn.close();
  await usageConn.close();
  await billingConn.close();
  rl.close();
}

run().catch(console.error);
