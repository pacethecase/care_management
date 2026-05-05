
/**
 * @param {string} content 
 * @param {string} btnText  
 * @param {string} btnUrl  
 */
const emailTemplate = (content, btnText, btnUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;border:2px solid #1B3A5C;border-radius:12px;overflow:hidden;background:#ffffff;">

          <!-- HEADER -->

        <tr>
        <td style="background:#1B3A5C;padding:24px 40px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
                <td style="background:#ffffff;border-radius:8px;padding:10px 24px;">
                <img 
                    src="${process.env.BASE_URL}/static/logo.png"
                    alt="Pace The Case"
                    width="160"
                    style="display:block;height:auto;"
                />
                </td>
            </tr>
            </table>
        </td>
        </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding:36px 40px 28px;color:#222;font-size:15px;line-height:1.8;">
              ${content}
            </td>
          </tr>

          <!-- BUTTON -->
          <tr>
            <td align="center" style="padding:0 40px 36px;">
              <a href="${btnUrl}"
                 style="display:inline-block;padding:13px 32px;background:#1B3A5C;
                        color:#ffffff;text-decoration:none;border-radius:7px;
                        font-size:15px;font-weight:600;letter-spacing:0.5px;">
                ${btnText}
              </a>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e0e7ef;margin:0;"/>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 40px 28px;text-align:center;color:#7a8fa6;font-size:12px;line-height:1.6;">
              <p style="margin:0 0 4px;">
                © ${new Date().getFullYear()} <strong style="color:#1B3A5C;">Pace The Case</strong>. All rights reserved.
              </p>
              <p style="margin:0;">This is an automated message — please do not reply directly to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = emailTemplate;