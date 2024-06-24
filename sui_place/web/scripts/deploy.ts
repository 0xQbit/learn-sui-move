import "dotenv/config"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/sui/utils";
import { SuiClient, SuiObjectChange } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

import path, { dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";

const PRIVATE_KEY = process.env.PRIVATE_KEY

if (!PRIVATE_KEY) {
    console.log("Error: Private Key missing in .env")
    process.exit(1)
}

const path_to_scripts = dirname(fileURLToPath(import.meta.url))

const keypair = Ed25519Keypair.fromSecretKey(fromB64(PRIVATE_KEY).slice(1)); // slice off unwanted part.
const client = new SuiClient({ url: "https://fullnode.devnet.sui.io:443" })

const contract_path = path.join(path_to_scripts, "../../contract")

console.log("Cooking contracts...")
const { dependencies, modules } = JSON.parse(execSync(
    `sui move build --dump-bytecode-as-base64 --path ${contract_path}`,
    { encoding: "utf-8" }
))
console.log("Serving contracts...")

console.log(`Deploying from ${keypair.toSuiAddress()}`)

const deploy_tx = new Transaction()
const [upgrade_cap] = deploy_tx.publish({
    modules, dependencies
})

deploy_tx.transferObjects([upgrade_cap], deploy_tx.pure.address((keypair.toSuiAddress())))

const { objectChanges, balanceChanges } = await client.signAndExecuteTransaction({
    signer: keypair, transaction: deploy_tx, options: {
        showBalanceChanges: true,
        showEffects: true,
        showEvents: true,
        showInput: false,
        showObjectChanges: true,
        showRawInput: false
    }
})
console.log(objectChanges, balanceChanges)

if (!balanceChanges) {
    console.log("Error: Balance changes was undefined!")
    process.exit(1)
}

if (!objectChanges) {
    console.log("Error: Object changes was undefined!")
    process.exit(1)
}

function parse_amount(amount: string): number {
    return parseInt(amount) / 1_000_000_000
}

console.log(`Spent ${Math.abs(parse_amount(balanceChanges[0].amount))} on deploy`)

const published_change = objectChanges.find(change => change.type == 'published')
if (published_change?.type !== "published") {
    console.log("Error: Did not find correct published change")
    process.exit(1)
}

function find_one_by_type(changes: SuiObjectChange[], type: string) {
    const object_change = changes.find(
        change => change.type === "created" && change.objectType === type
    )

    if (object_change?.type == "created") {
        return object_change.objectId
    }
}
const package_id = published_change.packageId

let deployed_address: any = {
    PACKAGE_ID: published_change.packageId,

}

const place_type = `${deployed_address.PACKAGE_ID}::place::Place`
const place_id = find_one_by_type(objectChanges, place_type)

if (!place_id) {
    console.log("Error: Could not find Place Object!")
    process.exit(1)
}

deployed_address.PLACE_ID = place_id

const quadrant_tx = new Transaction()
quadrant_tx.moveCall({
    target: `${package_id}::place::get_quadrants`,
    arguments: [quadrant_tx.object(place_id)]
})

console.log("Getting addresses of Quadrants")
const read_result = await client.devInspectTransactionBlock({
    sender: keypair.toSuiAddress(),
    transactionBlock: quadrant_tx
})
const quadrants = read_result.results?.[0]?.returnValues?.[0]?.[0]
if (!quadrants || quadrants.length != 129) {
    console.log("Incorrect value for quadrants result")
    process.exit(1)
}
const [__, ...bytes] = quadrants
const chunked_address_bytes = Array.from({ length: 4 }).map((_, i) => bytes.slice(i * 32, (i + 1) * 32))
const addresses = chunked_address_bytes.map(address_bytes => "0x" + address_bytes.map(byte => byte.toString(16).padStart(2, "0")).join(""))

deployed_address = Object.assign(deployed_address, {
    QUADRANT_ADDRESSES: addresses
})

console.log("Writing addresses to json...")
const deployed_path = path.join(path_to_scripts, "../src/deployed_objects.json")
writeFileSync(deployed_path, JSON.stringify(deployed_address, null, 4))
