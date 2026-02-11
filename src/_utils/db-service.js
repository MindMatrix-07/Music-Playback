import dynamo from './client-dynamo.js';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'AccessCodes';

// 1. Create Code
export async function createCodeCommon(code) {
    const cleanCode = code.trim().toLowerCase();

    // Check if exists first? Or just put with condition?
    // DynamoDB put overwrites by default. We want to ensure uniqueness?
    // Verify-Access checks existence usually.
    // But let's check basic "Get" first to be safe, or use condition expression.

    // Using ConditionExpression to ensure we don't overwrite if it exists
    const params = {
        TableName: TABLE_NAME,
        Item: {
            code: cleanCode,
            status: 'UNUSED', // Initial status
            createdAt: new Date().toISOString()
        },
        ConditionExpression: 'attribute_not_exists(code)'
    };

    try {
        await dynamo.send(new PutCommand(params));
        console.log(`[DynamoDB] Created: ${cleanCode}`);
        return { success: true, code: cleanCode };
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            throw new Error('Code already exists');
        }
        console.error('[DynamoDB] Create Failed:', error);
        throw error;
    }
}

// 2. Find Code
export async function findCodeCommon(code) {
    const cleanCode = code.trim().toLowerCase();

    const params = {
        TableName: TABLE_NAME,
        Key: {
            code: cleanCode
        }
    };

    try {
        const { Item } = await dynamo.send(new GetCommand(params));

        if (!Item) return null; // Not found

        return {
            code: Item.code,
            status: Item.status,
            spotifyId: Item.spotifyId, // Might be undefined if unused
            name: Item.name,
            isBlocked: Item.isBlocked // Optional
        };
    } catch (error) {
        console.error('[DynamoDB] Find Failed:', error);
        return { error: true, msg: 'Database Error' };
    }
}

// 3. Mark as Used / Bind to User
export async function markCodeAsUsedCommon(codeInfo, userId, name) {
    // codeInfo is the object returned from findCodeCommon
    const cleanCode = codeInfo.code.toLowerCase();

    const params = {
        TableName: TABLE_NAME,
        Key: { code: cleanCode },
        UpdateExpression: 'set #status = :s, spotifyId = :u, #name = :n, usedAt = :t',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#name': 'name' // 'name' is reserved in DynamoDB
        },
        ExpressionAttributeValues: {
            ':s': 'USED',
            ':u': userId,
            ':n': name,
            ':t': new Date().toISOString()
        }
    };

    try {
        await dynamo.send(new UpdateCommand(params));
        console.log(`[DynamoDB] Marked as USED: ${cleanCode} by ${userId}`);
        return true;
    } catch (error) {
        console.error('[DynamoDB] Update Failed:', error);
        throw error;
    }
}

// 4. Find User (Reverse Lookup)
// Note: This requires a Scan or GSI (Global Secondary Index) on spotifyId.
// Since user instructions didn't specify GSI, we might have to Scan (expensive) or warn user.
// However, the `verify-access.js` logic uses `findCodeCommon` (by code) primarily.
// `findUserCommon` was used in `verify-access.js`?
// Let's check `verify-access.js` content in step 514.
// It imports `findCodeCommon` and `markCodeAsUsedCommon`.
// It does NOT import `findUserCommon`!
// So we might not need `findUserCommon` for `verify-access.js`.
// But `auth.js` or others might use it?
// I'll implement `findUserCommon` using Scan for now (assuming small table) or comment it out if not needed.
// previous `db-service.js` had it.
// I'll keep it but use Scan as fallback.

export async function findUserCommon(userId) {
    // Scan for spotifyId = userId
    const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'spotifyId = :uid',
        ExpressionAttributeValues: {
            ':uid': userId
        }
    };

    try {
        // Note: Scan is inefficient for large tables. Recommend GSI 'SpotifyIdIndex'
        const { Items } = await dynamo.send(new ScanCommand(params)); // Need to import ScanCommand
        if (Items && Items.length > 0) {
            return Items[0];
        }
        return null;
    } catch (error) {
        console.error('[DynamoDB] Find User Failed:', error);
        return null;
    }
}


