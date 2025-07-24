Making RPC requests
To interface with the Solana network, a client needs to construct and send JSON RPC requests to an RPC endpoint.

Add dependencies
The @solana/web3.js library provides a convenient RPC client Connection class that has an API for submitting RPC requests to a JSON RPC endpoint.

yarn
npm
yarn install @solana/web3.js@1 \
             react-native-get-random-values \
             buffer

Add polyfills
After installing, ensure you have also added these polyfills to the index.js of your React native app. These are needed in some parts of @solana/web3.js because it is originally written as a web/node library and, as a result, certain expected APIs are missing in a React Native environment.

Creating a Connection client
The Connection class represents a connection to a Solana RPC endpoint and provides convenient functions to make RPC requests.

Construct a Connection client by passing in an RPC endpoint and an optional commitment config:

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

The Connection class created can be reused throughout your application.

Usage
After creation, call various asynchronous RPC functions and receive responses from the RPC endpoint.

// `getLatestBlockhash` RPC request
const blockhash = await connection.getLatestBlockhash();

// `getBalance` RPC request
const balanceInLamports = await connection.getBalance();

// Sending a Transaction
const txSignature = await sendTransaction(tx);

View the official documentation to see the full list of available RPC functions, parameter types, and response types.





Building transactions
A client interacts with the Solana network by submitting a transaction to the cluster. Transactions allow a client to invoke instructions of on-chain Programs.

For a full explanation, see the core docs overview of a transaction.

Add dependencies
The @solana/web3.js library provides convenient classes and Solana primitive types to build transactions.

yarn
npm
npm install @solana/web3.js

Add polyfills
After installing, ensure you have also added these polyfills to your React native app. These are needed by some parts of @solana/web3.js because it is originally written as a web/node library and, as a result, certain expected APIs are missing in a React Native environment.

Example: SOL Transfer Transaction
In the following example, we create a transaction that invokes the System Program's transfer instruction to send SOL to an address.

A transaction instruction is comprised of a program id, a list of accounts, and instruction data specific to the program.

Versioned Transactions
Legacy Transactions
A versioned transaction is a new format for transactions recommended for use by clients.

As an example, we'll be invoking the transfer instruction from the System Program. Use the SystemProgram factory class to conveniently generate the transfer instruction.

import {
  Connection,
  PublicKey,
  VersionedTransaction,
  SystemProgram,
} from "@solana/web3.js";

// Create a list of Program instructions to execute.
const instructions = [
  SystemProgram.transfer({
    fromPubkey: fromPublicKey,
    toPubkey: toPublicKey,
    lamports: 1_000_000,
  }),
];

// Connect to an RPC endpoint and get the latest blockhash, to include in
// the transaction.
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

// Create the "message" of a transaction and compile to `V0Message` format.
const txMessage = new TransactionMessage({
  payerKey: fromPublicKey,
  recentBlockhash: latestBlockhash.blockhash,
  instructions,
}).compileToV0Message();

// Construct the Versioned Transaction passing in the message.
const versionedTransaction = new VersionedTransaction(txMessage);

Send a Transaction
After a transaction is signed by the appropriate accounts, it can be submitted to the Solana network via RPC. See the next guide, Using Mobile Walelt Adapter to learn how to sign transactions.

Versioned Transactions
Legacy Transactions
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  sendTransaction,
  clusterApiUrl,
  Connection,
  VersionedTransaction,
  confirmTransaction,
} from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const unsignedTx = new VersionedTransaction(/* ... */);
const signedTx: VersionedTransaction = await transact((wallet) => {
  /* ...sign `unsignedTx` with Mobile Wallet Adapter... */
});

// After sending, a transaction signature is returned.
const txSignature = await connection.sendTransaction(signedTx);

// Confirm the transaction was successful.
const confirmationResult = await connection.confirmTransaction(
  txSignature,
  "confirmed"
);

if (confirmationResult.value.err) {
  throw new Error(JSON.stringify(confirmationResult.value.err));
} else {
  console.log("Transaction successfully submitted!");
}




Using Mobile Wallet Adapter
The Mobile Wallet Adapter protocol is a spec that enables a secure communication exchange between a dApp and an MWA-compliant wallet app installed on the device.

Mobile Wallet Adapter 2.0 is the newest and current version of the Mobile Wallet Adapter protocol. The complete 2.0 spec is viewable here.

Add dependencies
Solana Mobile has published two React Native libraries to use Mobile Wallet Adapter.

@solana-mobile/mobile-wallet-adapter-protocol is the core library that implements the Mobile Wallet Adapter protocol for React Native.
@solana-mobile/mobile-wallet-adapter-protocol-web3js is a convenience wrapper package around the core library that enables use of common types from @solana/web3.js – such as Transaction and Uint8Array.
These libraries provide a convenient API to connect, issue signing requests to a locally installed wallet app, and receive responses.

yarn
npm
yarn install @solana-mobile/mobile-wallet-adapter-protocol-web3js \
             @solana-mobile/mobile-wallet-adapter-protocol

Establishing an MWA session
API Reference
To establish a session, or request to 'connect', with an MWA wallet, use the transact method provided by @solana-mobile/mobile-wallet-adapter-protocol-web3js.

Calling transact dispatches an assocication intent to a locally installed MWA wallet app and prompts the user to approve or reject the connection request.

Once session is established, the user can begin issuing MWA requests and receiving responses from the wallet app within the provided callback.

import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

await transact(async (wallet: Web3MobileWallet) => {
  /* ...In callback, send requests to `wallet`... */
});

tip
Use the transact function from @solana-mobile/mobile-wallet-adapter-protocol-web3js rather than @solana-mobile/mobile-wallet-adapter-protocol.

The former provides convenient wrappers around common web3.js Solana types like Transaction while the latter provides base64 encoded byte payloads.

Connecting to a wallet
API Reference
After session establishment, you can connect to the wallet by issuing an authorize request. This authorization step is required if you want to request signing services from the wallet.

Define the App Identity of your dApp so that the wallet app can properly display your dApp info to the user.

name: The name of your app.
uri: The web URL associated with your app.
icon: A path to your app icon relative to the app uri above.
import {transact, Web3MobileWallet} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

export const APP_IDENTITY = {
  name: 'React Native dApp',
  uri:  'https://yourdapp.com'
  icon: "favicon.ico", // Full path resolves to https://yourdapp.com/favicon.ico
};

const authorizationResult = await transact(async (wallet: Web3MobileWallet) => {
    const authorizationResult = await wallet.authorize({
        cluster: 'solana:devnet',
        identity: APP_IDENTITY,
    });

    /* After approval, signing requests are available in the session. */

    return authorizationResult;
});

console.log("Connected to: " + authorizationResult.accounts[0].address)

Authorization Result

If the user approves, the wallet returns an AuthorizationResult response that contains the user's authorized wallet accounts, an auth_token, and wallet_uri_base.

In practice, most wallet apps currently only support single account authorization, so there will be at most 1 item in accounts.

type AuthorizationResult = Readonly<{
  accounts: Account[];
  auth_token: AuthToken;
  wallet_uri_base: string;
  sign_in_result?: SolanaSignInOutput;
}>;

See the SDK reference for a full explanation of the AuthorizationResult response type.

Connecting with an auth_token
For subsequent sessions with the wallet app, you can skip the authorization step by including an auth_token in the authorize request.

If valid, the user is able to skip the connection approval dialog for authorization.

import {transact, Web3MobileWallet} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

export const APP_IDENTITY = {
  name: 'React Native dApp',
  uri:  'https://yourdapp.com'
  icon: "./favicon.ico",
};

// If we have one, retrieve an authToken from a previous authorization.
const storedAuthToken = maybeGetStoredAuthToken(); // dummy placeholder function

await transact(async (wallet: Web3MobileWallet) => {
    // If we have a previously stored authToken, we can pass it into `authorize`.
    const authorizationResult = await wallet.authorize({
        chain: 'solana:devnet',
        identity: APP_IDENTITY,
        auth_token: storedAuthToken ? storedAuthToken: undefined,
    });

    // Rest of transact code goes below...
});

Deauthorizing a wallet
API Reference
A dApp can revoke authorization or "disconnect" from a wallet by sending a deauthorize request. The wallet invalidate the provided authToken.

await transact(async (wallet) => {
  if (!previouslyStoredAuthToken) {
    return;
  }

  // Pass in the prior auth token to invalidate it.
  await wallet.deauthorize({ auth_token: previouslyStoredAuthToken });
});

Sign in with Solana
To connect to a wallet and simultaneously verify the user's ownership of the wallet, use the Sign in with Solana feature. SIWS combines the authorize and signMessage step and returns a SolanaSignInOutput that can be verified by the dApp.

To initiate SIWS, include the optional sign_in_payload parameter in the authorize request. If provided, the wallet will display a dedicated SIWS UI and prompt the user to sign in by signing the statement message.

const signInResult = await transact(async (wallet: Web3MobileWallet) => {
  const authorizationResult = await wallet.authorize({
    chain: 'solana:devnet',
    identity: APP_IDENTITY,
    sign_in_payload: {
      domain: 'yourdomain.com',
      statement: 'Sign into React Native Sample App',
      uri: 'https://yourdomain.com',
    },
  });

  return authorizationResult.sign_in_result;
}

Verifying the sign-in result
If approved, the wallet will include a sign_in_result payload in the AuthorizationResult response. The dApp can then verify that the sign_in_result was correctly signed by the user's wallet.

The @solana/wallet-standard-util library provides a verifySignIn helper method for SIWS message and signature verification.

import type {
  SolanaSignInInput,
  SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";

export function verifySIWS(
  input: SolanaSignInInput,
  output: SolanaSignInOutput
): boolean {
  const serialisedOutput: SolanaSignInOutput = {
    account: {
      publicKey: new Uint8Array(output.account.publicKey),
      ...output.account,
    },
    signature: new Uint8Array(output.signature),
    signedMessage: new Uint8Array(output.signedMessage),
  };
  return verifySignIn(input, serialisedOutput);
}

See the Phantom SIWS docs for more information. It is written for web dApps, but can be extrapolated for mobile dApps.

Signing and sending a transaction
API Reference
To request a wallet to sign and then send a Solana transaction, use the signAndSendTransactions method. With this method, the wallet will handle both signing the transactions then submitting them to the Solana network.

This request sends an unsigned transaction to the wallet. If authorized, the wallet will then sign the transaction and send it to the network with its own implementation.

Versioned Transactions
Legacy Transactions
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  sendTransaction,
  clusterApiUrl,
  Connection,
  VersionedTransaction,
  confirmTransaction,
} from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const txSignature = await transact((wallet) => {
  // Authorize the wallet session
  const authorizationResult = await wallet.authorize({
    cluster: "solana:devnet",
    identity: APP_IDENTITY,
  });

  // Convert base64 address to web3.js PublicKey class
  const authorizedPubkey = new PublicKey(
    toByteArray(authorizationResult.accounts[0].address)
  );

  // Construct an instruction to transfer 1,000,000 lamports to a randomly generated account
  const randomKeypair = Keypair.generate();
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: authorizedPubkey,
      toPubkey: randomKeypair.publicKey,
      lamports: 1_000_000,
    }),
  ];

  // Construct the Versioned message and transaction.
  const txMessage = new TransactionMessage({
    payerKey: authorizedPubkey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message();

  const transferTx = new VersionedTransaction(txMessage);

  // Send the unsigned transaction, the wallet will sign and submit it to the network,
  // returning the transaction signature.
  const transactionSignatures = await wallet.signAndSendTransactions({
    transactions: [transferTx],
  });

  return transactionSignatures[0];
});

// Confirm the transaction was successful.
const confirmationResult = await connection.confirmTransaction(
  txSignature,
  "confirmed"
);

if (confirmationResult.value.err) {
  throw new Error(JSON.stringify(confirmationResult.value.err));
} else {
  console.log("Transaction successfully submitted!");
}

The result from sending a transaction is a base58 transaction signature (or transaction ID). This transaction signature can be used to uniquely identify your transaction on the ledger.

Using confirmTransaction, you can check that the transaction was confirmed by the network. For other commitment levels, read about Commitment Status.

Signing Transactions
API Reference
Alternatively, you can request the wallet to just sign a transaction by issuing a signTransactions request.

Versioned Transactions
Legacy Transactions
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { toByteArray } from "react-native-quick-base64";

// Connect to an RPC endpoint and get the latest blockhash, to include in
// the transaction.
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const signedTx = await transact(async (wallet) => {
  /* ...transaction code from above... */
  const transferTx = new VersionedTransaction(txMessage);

  // Request to sign the transaction
  const signedTxs = await wallet.signTransactions({
    transactions: [transferTx],
  });

  return signedTxs[0];
});

The response returned will be a signed Transaction that can be submitted to an RPC endpoint with the sendTransaction function from the Connection class.

Signing messages
API Reference
To request off-chain message signing, issue a signMessages request. In this case, a message is any payload of bytes.

import {transact} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

// Convert 'Hello world!' to a byte array.
const message = 'Hello world!'
const messageBuffer = new Uint8Array(
  message.split('').map(c => c.charCodeAt(0)),
);

const signedMessages = await transact(async (wallet) => {
  // Authorize the wallet session.
  const authorizationResult = await wallet.authorize({
      cluster: 'solana:devnet',
      identity: APP_IDENTITY,
  });

  // Request to sign the payload with the authorized account.
  const signedMessages = wallet.signMessages({
    addresses: [authorizationResult.accounts[0].address].
    payloads: [messageBuffer]
  })

  return signedMessages;
});

The response returned will be an Uint8Array[], where each item corresponds to the signed message input.



Mobile Wallet Adapter Typescript Reference
Connect to wallet apps and sign transactions and messages with the Mobile Wallet Adapter API.

API Reference

tip
Mobile Wallet Adapter 2.0 is the newest and current version of the Mobile Wallet Adapter protocol.

The complete 2.0 spec is viewable here and the legacy API is viewable here.

Install dependencies
@solana-mobile/mobile-wallet-adapter-protocol

Base library that implements the MWA client. Include this, but only import transact from the wrapper library.
@solana-mobile/mobile-wallet-adapter-protocol-web3js

A convenience wrapper for the base library that enables with web3.js primitives like Transaction.
yarn
npm
yarn add \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \

Import into a file
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";



Mobile Wallet API Methods
Reference for the Mobile Wallet API for dApps to connect to wallets and receive signing services.

transact
This is the first step in using the Mobile Wallet API.

Starts a Mobile Wallet Adapter session with a locally installed MWA-compatible wallet.

Parameters:
callback: (wallet: Web3MobileWallet) => TReturn required

A callback triggered after session establishment, in which the dApp can issue MWA requests to the wallet app, using the wallet object.

config: WalletAssociationConfig optional

Configuration object containing the following fields:

baseUri string optional

URI used for custom wallet association.

Details
Result:
The result will be a Promise<TReturn> with TReturn equal to what is returned from the callback parameter.

Code sample:
const result = await transact(async (wallet: Web3MobileWallet) => {
    /* ...Issue MWA requests... */
    return "done";
});

Return:
console.log(result) // "done"

Web3MobileWallet.authorize
Non-privileged method. Requests authorization from the connected wallet for access to privileged methods within the session.

Parameters:
chain: string optional

The chain identifier for the chain with which the dapp intends to interact;

Supported values include "solana:mainnet", "solana:testnet", "solana:devnet", "mainnet-beta", "testnet", "devnet". If not set, defaults to "solana:mainnet".

identity: object optional

A JSON object containing the following fields:

uri string optional

A URI representing the web address associated with the dapp making this authorization request. If present, it must be an absolute, hierarchical URI.

icon string optional

A relative path (from uri) to an image asset file of an icon identifying the dapp making this authorization request.

name string optional

the display name for this dapp.

features: string[] optional

A list of feature identifiers that the dapp intends to use in the session. Defaults to null.

addresses: string[] optional

A list of base64 encoded account addresses that the dapp wishes to be included in the authorized scope. Defaults to null.

auth_token: string optional

A string representing a unique identifying token previously issued by the wallet to the dapp from a previous call to authorize or clone_authorization. If present, the wallet should attempt to reauthorize the dapp silently without prompting the user.

sign_in_payload: SignInPayload optional

An object containing the Sign-In input fields as described by the Sign In With Solana specification. If present, the wallet should present the SIWS message to the user and include the sign_in_result in the response.

Result:
The result will be a JSON object containing the following fields:

auth_token: string: A string representing a unique identifying token issued by the wallet to the dapp. Use this on future connections to reauthorize access to privileged methods.
accounts: one or more value objects that represent the accounts to which this auth token corresponds. These objects hold the following properties:
address: string:a base64-encoded public key for this account.
chains: a list of chain identifiers supported by this account. These should be a subset of the chains supported by the wallet.
label: string (optional): a human-readable string that describes the account.
display_address: string (optional): the address for this account. The format of this string will depend on the chain, and is specified by the display_address_format field
display_address_format: string (optional): the format of the display_address.
features: string[] (optional): a list of feature identifiers that represent the features that are supported by this account. These features must be a subset of the features returned by get_capabilities. If this parameter is not present the account has access to all available features (both mandatory and optional) supported by the wallet.
icon: string (optional): a data URI containing a base64-encoded SVG, WebP, PNG, or GIF image of an icon for the account. This may be displayed by the app.
wallet_uri_base: string (optional): A custom URI specified by the wallet that the dapp should use for subsequent connections.
sign_in_result: object (optional): If the authorize request included the SIWS sign_in_payload, the result will be returned here as an object containing the following:
address: string: the address of the account that was signed in. The address of the account may be different from the provided input address, but must be the address of one of the accounts returned in the accounts field.
signed_message: string: the base64-encoded signed message payload
signature: string: the base64-encoded signature
signature_type: string (optional): the type of the message signature produced. If not provided in this response, the signature must be "ed25519".
Code sample:
const result = await transact(async (wallet: Web3MobileWallet) => {
    const authResult = wallet.authorize({
      chain: 'solana:devnet',
      identity: {
        name: 'Example dApp',
        uri:  'https://yourdapp.com'
        icon: "favicon.ico", // Resolves to https://yourdapp.com/favicon.ico
      },
    }));
    return authResult;
});


Result:
{
  "auth_token": "<auth_token>",
  "accounts": [
      {
          "address": "<address>", 
          "display_address": "<display_address>",
          "display_address_format": "<display_address_format>",
          "label": "<label>", 
          "icon": "<icon>",
          "chains": ["<chain_id>", "..."], 
          "features": ["<feature_id>", "..."]
      },
      "..."
  ],
  "wallet_uri_base": "<wallet_uri_base>",
  "sign_in_result": {
      "address": "<address>", 
      "signed_message": "<signed_message>"
      "signature": "<signature>"
      "signature_type": "<signature_type>"
  }
}

Web3MobileWallet.deauthorize
Non-privileged method. This method will make the provided auth_token invalid for use (if it ever was valid).

If, during the current session, the specified auth token was returned by the most recent call to authorize or reauthorize, the session will be placed into the unauthorized state.

Parameters:
auth_token: string required

An auth token string previously returned by a call to authorize, reauthorize, or clone_authorization, which will be deauthorized.

Result:
The result will be an empty JSON object.

Code sample:
const authToken = getPreviouslyStoredAuthToken()
const result = await transact(async (wallet: Web3MobileWallet) => {
  return await wallet.deauthorize({auth_token: authToken});
});

Result:
{}

Web3MobileWallet.getCapabilities
Non-privileged method. This method enumerates the capabilities and limits of the wallet's MWA implementation.

Parameters:
None

Result:
The result will be a JSON object as defined in authorize, but the values may be updated and differ from the values originally provided in the authorize response for the auth token.

max_transactions_per_request: (optional) if present, the max number of transaction payloads which can be signed by a single sign_transactions or sign_and_send_transactions request. If absent, the implementation doesn’t publish a specific limit for this parameter.
max_messages_per_request: (optional) if present, the max number of transaction payloads which can be signed by a single sign_messages request. If absent, the implementation doesn’t publish a specific limit for this parameter.
supported_transaction_versions: the Solana network transaction formats supported by this wallet endpoint. Allowed values are those defined for TransactionVersion (for e.g., "legacy", 0, etc).
features: a list of feature identifiers for the optional features supported by the wallet. Dapps can assume that mandatory features are supported by the wallet.
Code sample:
const result = await transact(async (wallet: Web3MobileWallet) => {
  return await wallet.getCapabilities();
});

Result:
{
    "max_transactions_per_request": 10,
    "max_messages_per_request": 10,
    "supported_transaction_versions": ["legacy", 0],
    "features": ["<feature_id>"]
}

Web3MobileWallet.signAndSendTransactions
Privileged method.

This method requests the wallet to sign the specified transactions with the private keys for the authorized addresses, submit the transactions to the network, and return the transaction signatures to the dapp.

Parameters:
transactions: Transaction[] required

An array of one or more transactions to sign and send. The transaction are of type Transaction or VersionedTransaction from the web3.js library.

minContextSlot: number

The minimum slot number at which to perform preflight transaction checks.

Result:
string[] - the corresponding base64-encoded transaction signatures.
Code sample:
const result = await transact(async (wallet: Web3MobileWallet) => {
  const authResult = await wallet.authorize({
    cluster: 'devnet',
    identity: APP_IDENTITY,
  }));
  
  const publicKey = getPublicKeyFromAuth(authResult)

  // Create a web3.js Transaction that transfers
  // lamports to a randomly created address.
  const keypair = Keypair.generate();
  const randomTransferTransaction = new Transaction({
    ...latestBlockhash,
    feePayer: publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: keypair.publicKey,
      lamports: 1_000_000,
    }),
  );

  // Signs the Transactions with the private key of the account 
  // corresponding to `publicKey` and submits to the network.
  const transactionSignatures = await wallet.signAndSendTransactions({
    transactions: [randomTransferTransaction],
  });
  return transactionSignatures;
});

Result:
["<transaction_signature>", ...],

Web3MobileWallet.signTransactions
Privileged method. Request to sign the given transactions with the private keys for the requested authorized account.

Parameters:
transactions: Transaction[] required

An array of one or more transactions to sign. The transaction are of type Transaction or VersionedTransaction from the web3.js library.

Result:
Transaction[] - the corresponding Transactions signed with the private keys for the requested authorized account addresses.
Code sample:
const result = await transact(async (wallet: Web3MobileWallet) => {
  const authResult = await wallet.authorize({
    cluster: 'devnet',
    identity: APP_IDENTITY,
  }));
  
  const publicKey = getPublicKeyFromAuth(authResult)

  // Create a web3.js Transaction that transfers
  // lamports to a randomly created address.
  const keypair = Keypair.generate();
  const randomTransferTransaction = new Transaction({
    ...latestBlockhash,
    feePayer: publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: keypair.publicKey,
      lamports: 1_000,
    }),
  );

  // Signs the Transactions with the private key of the account 
  // corresponding to `publicKey`
  const signedTransactions = await wallet.signTransactions({
        transactions: [randomTransferTransaction],
  });
  return signedTransactions;
});

Result:
[<signed_transaction>, ...],

Web3MobileWallet.signMessages
Privileged method. Request to sign the given messages payloads with the private keys for the requested authorized account.

Parameters:
addresses: string[] required

One or more base64-encoded addresses of the accounts which should be used to sign message. These should be a subset of the addresses returned by authorize or reauthorize for the current session's authorization.

payloads: Uint8Array[] required

One or more byte arrays where each byte array is a message payload to sign.

Result:
Uint8Array[] - the corresponding base64-encoded signed message payloads.
Code sample:
