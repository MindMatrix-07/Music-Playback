const { google } = require('googleapis');

// ---------------------------------------------------------
// PASTE YOUR CREDENTIALS HERE
// ---------------------------------------------------------
// 1. Get Key: Credentials -> API Keys -> Copy "Key 1"
const API_KEY = 'PASTE_YOUR_API_KEY_HERE';

// 2. Get CX: Programmable Search Engine -> Overview -> Search engine ID
const CX_ID = 'PASTE_YOUR_CX_ID_HERE';
// ---------------------------------------------------------

async function testSearch() {
    console.log("Testing Google Custom Search API...");
    console.log(`Using Key: ${API_KEY.substring(0, 5)}...`);
    console.log(`Using CX:  ${CX_ID}`);

    const customsearch = google.customsearch('v1');

    try {
        const res = await customsearch.cse.list({
            auth: API_KEY,
            cx: CX_ID,
            q: 'flower', // Simple test query
            num: 1
        });

        console.log("\n✅ SUCCESS! The API is working.");
        console.log("First result title:", res.data.items[0].title);
    } catch (e) {
        console.error("\n❌ FAILED!");
        console.error("Error Code:", e.code);
        console.error("Error Message:", e.message);

        if (e.response && e.response.data && e.response.data.error) {
            console.error("Full Details:", JSON.stringify(e.response.data.error, null, 2));
        }

        console.log("\n---------------------------------------------------");
        console.log("TROUBLESHOOTING:");
        if (e.message.includes("Custom Search JSON API")) {
            console.log("1. You have NOT enabled 'Custom Search API' in Google Cloud Console.");
            console.log("   Link: https://console.cloud.google.com/marketplace/product/google/customsearch.googleapis.com");
        } else if (e.message.includes("keyInvalid")) {
            console.log("2. Your API Key is wrong/copied incorrectly.");
        } else if (e.message.includes("projectNotConfigured")) {
            console.log("3. The 'Custom Search API' is enabled, but not in the project specific to this key.");
        }
    }
}

testSearch();
