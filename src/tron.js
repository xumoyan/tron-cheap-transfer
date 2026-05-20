import { APP_CONFIG } from "./tokens.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const METHOD_ID_EXECUTE = "3593564c";
let publicNodeCursor = 0;
const TRC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];
const PERMIT2_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" }
    ]
  }
];

export function getTronWeb() {
  return window.tronWeb || window.tronLink?.tronWeb || null;
}

export async function connectTronLink() {
  if (!window.tronLink && !window.tronWeb) {
    throw new Error("未检测到 TronLink，请先安装或打开 TronLink 钱包。");
  }

  if (window.tronLink?.request) {
    const result = await window.tronLink.request({ method: "tron_requestAccounts" });
    if (result?.code && result.code !== 200) {
      throw new Error(result.message || "TronLink 拒绝连接。");
    }
  }

  const tronWeb = getTronWeb();
  const address = tronWeb?.defaultAddress?.base58;
  if (!tronWeb || !address) {
    throw new Error("TronLink 尚未解锁或未选择账户。");
  }
  return { tronWeb, address };
}

export function shortAddress(address) {
  if (!address || address.length < 12) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

export function tronscanAddressUrl(address) {
  return `${APP_CONFIG.tronscanBaseUrl}/address/${address}`;
}

export function tronscanTxUrl(txid) {
  return `${APP_CONFIG.tronscanBaseUrl}/transaction/${txid}`;
}

export function parseUnits(value, decimals) {
  const clean = String(value || "").trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error("请输入有效数量。");
  }
  const [whole, fraction = ""] = clean.split(".");
  if (fraction.length > decimals) {
    throw new Error(`该 Token 最多支持 ${decimals} 位小数。`);
  }
  const scale = 10n ** BigInt(decimals);
  return BigInt(whole) * scale + BigInt((fraction.padEnd(decimals, "0") || "0"));
}

export function formatUnits(value, decimals, maxFraction = 6) {
  const amount = BigInt(value || 0);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = String(amount % scale).padStart(decimals, "0");
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : String(whole);
}

export function calculateSavings(config = APP_CONFIG.energy) {
  const classicUserEnergy = config.classicTransfer * config.classicUserPercent / 100;
  const routerUserEnergy = config.routerTransfer * config.routerUserPercent / 100;
  const classicCostSun = classicUserEnergy * config.sunPerEnergy + config.classicBandwidth * config.sunPerBandwidth;
  const routerCostSun = routerUserEnergy * config.sunPerEnergy + config.routerBandwidth * config.sunPerBandwidth;
  const savedEnergy = classicUserEnergy - routerUserEnergy;
  const savedTrx = Math.max(0, classicCostSun - routerCostSun) / 1_000_000;
  const savedUsd = savedTrx * config.trxUsd;
  const percent = (savedEnergy / classicUserEnergy) * 100;
  return { savedEnergy, savedTrx, savedUsd, percent };
}

export function validateAddress(address) {
  const tronWeb = getTronWeb();
  if (tronWeb?.isAddress) return tronWeb.isAddress(address);
  try {
    const hex = base58ToHex(address);
    return hex.length === 50 && hex.startsWith("41");
  } catch {
    return false;
  }
}

export async function getTokenContract(tokenAddress) {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("请先连接 TronLink。");
  return tronWeb.contract(TRC20_ABI, tokenAddress);
}

export async function getPermit2Contract() {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("请先连接 TronLink。");
  return tronWeb.contract(PERMIT2_ABI, APP_CONFIG.permit2);
}

export async function getTokenAllowance(tokenAddress, ownerAddress) {
  const contract = await getTokenContract(tokenAddress);
  const raw = await contract.allowance(ownerAddress, APP_CONFIG.permit2).call();
  return toBigInt(raw);
}

export async function getRouterAllowance(tokenAddress, ownerAddress) {
  const contract = await getPermit2Contract();
  const raw = await contract.allowance(ownerAddress, tokenAddress, APP_CONFIG.universalRouter).call();
  return parsePermit2Allowance(raw);
}

export async function getTokenBalance(tokenAddress, ownerAddress) {
  return readTrc20Balance(tokenAddress, ownerAddress);
}

export async function approvePermit2(tokenAddress, ownerAddress, amount) {
  const result = {
    tokenApprovalTx: "",
    routerApprovalTx: ""
  };
  const tokenAllowance = await getTokenAllowance(tokenAddress, ownerAddress);
  if (tokenAllowance < amount) {
    const contract = await getTokenContract(tokenAddress);
    result.tokenApprovalTx = await contract.approve(APP_CONFIG.permit2, amount.toString()).send({
      feeLimit: APP_CONFIG.feeLimitSun,
      callValue: 0,
      shouldPollResponse: false
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const routerAllowance = await getRouterAllowance(tokenAddress, ownerAddress);
  if (routerAllowance.amount < amount || routerAllowance.expiration <= now + 60) {
    const expiration = now + 365 * 24 * 60 * 60;
    const contract = await getPermit2Contract();
    result.routerApprovalTx = await contract
      .approve(tokenAddress, APP_CONFIG.universalRouter, amount.toString(), String(expiration))
      .send({
        feeLimit: APP_CONFIG.feeLimitSun,
        callValue: 0,
        shouldPollResponse: false
      });
  }

  return result;
}

export async function approveTokenToPermit2(tokenAddress, amount) {
  const contract = await getTokenContract(tokenAddress);
  return contract.approve(APP_CONFIG.permit2, amount.toString()).send({
    feeLimit: APP_CONFIG.feeLimitSun,
    callValue: 0,
    shouldPollResponse: false
  });
}

export async function broadcastRouterTransfer({ ownerAddress, recipient, tokenAddress, amount, deadline }) {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("请先连接 TronLink。");
  const details = [
    {
      from: ownerAddress,
      to: recipient,
      amount,
      token: tokenAddress
    }
  ];

  const finalDeadline = deadline ? BigInt(deadline) : BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
  const calldata = encodeExecuteCalldata({ details, deadline: finalDeadline });
  const parameter = calldata.slice(8);
  const tx = await tronWeb.transactionBuilder.triggerSmartContract(
    APP_CONFIG.universalRouter,
    "execute(bytes,bytes[],uint256)",
    {
      feeLimit: APP_CONFIG.feeLimitSun,
      callValue: 0,
      rawParameter: parameter
    },
    [],
    ownerAddress
  );

  if (!tx?.result?.result || !tx.transaction) {
    throw new Error(tx?.result?.message || "Router 交易构造失败。");
  }
  const signed = await tronWeb.trx.sign(tx.transaction);
  return tronWeb.trx.sendRawTransaction(signed);
}

export function encodeExecuteCalldata({ details, deadline }) {
  const commands = "0d";
  const input = encodeBatchTransferInput(details);
  return `${METHOD_ID_EXECUTE}${encodeExecuteArgs(commands, [input], deadline)}`;
}

export function buildRouterTransfer({ ownerAddress, recipient, tokenAddress, amount }) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
  const details = [
    {
      from: ownerAddress,
      to: recipient,
      amount,
      token: tokenAddress
    }
  ];
  return {
    calldata: encodeExecuteCalldata({ details, deadline }),
    deadline,
    details
  };
}

export async function estimateTransferResources({ ownerAddress, recipient, tokenAddress, amount, calldata }) {
  const routerCalldata = calldata || buildRouterTransfer({ ownerAddress, recipient, tokenAddress, amount }).calldata;
  const classicParameter = encodeAddress(recipient) + encodeUint(amount);
  const routerParameter = stripHex(routerCalldata).slice(8);

  const [classic, router, contractInfo] = await Promise.all([
    estimateContractCall({
      ownerAddress,
      contractAddress: tokenAddress,
      functionSelector: "transfer(address,uint256)",
      parameter: classicParameter,
      fallbackEnergy: APP_CONFIG.energy.classicTransfer,
      fallbackBandwidth: APP_CONFIG.energy.classicBandwidth
    }),
    estimateContractCall({
      ownerAddress,
      contractAddress: APP_CONFIG.universalRouter,
      functionSelector: "execute(bytes,bytes[],uint256)",
      parameter: routerParameter,
      fallbackEnergy: APP_CONFIG.energy.routerTransfer,
      fallbackBandwidth: Math.ceil(routerCalldata.length / 2)
    }),
    getContractResourceInfo(APP_CONFIG.universalRouter)
  ]);

  const classicUserPercent = APP_CONFIG.energy.classicUserPercent;
  const routerUserPercent = contractInfo.userResourcePercent ?? APP_CONFIG.energy.routerUserPercent;
  const classicUserEnergy = Math.ceil(classic.energy * classicUserPercent / 100);
  const routerUserEnergy = Math.ceil(router.energy * routerUserPercent / 100);
  const classicEnergyCostSun = classicUserEnergy * APP_CONFIG.energy.sunPerEnergy;
  const routerEnergyCostSun = routerUserEnergy * APP_CONFIG.energy.sunPerEnergy;
  const classicBandwidthCostSun = classic.bandwidth * APP_CONFIG.energy.sunPerBandwidth;
  const routerBandwidthCostSun = router.bandwidth * APP_CONFIG.energy.sunPerBandwidth;
  const classicTotalSun = classicEnergyCostSun + classicBandwidthCostSun;
  const routerTotalSun = routerEnergyCostSun + routerBandwidthCostSun;

  return {
    classic: {
      energy: classic.energy,
      bandwidth: classic.bandwidth,
      userPercent: classicUserPercent,
      userEnergy: classicUserEnergy,
      energyCostSun: classicEnergyCostSun,
      bandwidthCostSun: classicBandwidthCostSun,
      totalSun: classicTotalSun
    },
    router: {
      energy: router.energy,
      bandwidth: router.bandwidth,
      userPercent: routerUserPercent,
      userEnergy: routerUserEnergy,
      energyCostSun: routerEnergyCostSun,
      bandwidthCostSun: routerBandwidthCostSun,
      totalSun: routerTotalSun,
      contractOriginEnergyLimit: contractInfo.originEnergyLimit ?? null
    },
    saved: {
      energy: Math.max(0, classicUserEnergy - routerUserEnergy),
      bandwidth: Math.max(0, classic.bandwidth - router.bandwidth),
      sun: Math.max(0, classicTotalSun - routerTotalSun)
    },
    source: {
      classic: classic.source,
      router: router.source,
      subsidy: contractInfo.source
    }
  };
}

export function parseRouterTransferData(calldata, tokenMeta) {
  const clean = stripHex(calldata);
  if (!clean.startsWith(METHOD_ID_EXECUTE)) throw new Error("当前 data 不是 UniversalRouter execute 调用。");
  const body = clean.slice(8);
  const commandsOffset = Number(readUint(body, 0));
  const inputsOffset = Number(readUint(body, 32));
  const deadline = readUint(body, 64);
  const commands = readBytes(body, commandsOffset);
  const inputOffsetsBase = inputsOffset + 32;
  const inputCount = Number(readUint(body, inputsOffset));
  const inputs = [];
  for (let index = 0; index < inputCount; index += 1) {
    const relativeOffset = Number(readUint(body, inputOffsetsBase + index * 32));
    inputs.push(readBytes(body, inputOffsetsBase + relativeOffset));
  }

  const transfers = [];
  if (commands === "0d" && inputs[0]) {
    const input = inputs[0];
    const arrayOffset = Number(readUint(input, 0));
    const count = Number(readUint(input, arrayOffset));
    const rowsStart = arrayOffset + 32;
    for (let index = 0; index < count; index += 1) {
      const rowStart = rowsStart + index * 128;
      const amount = readUint(input, rowStart + 64);
      transfers.push({
        from: evmHexToTron(readWord(input, rowStart)),
        to: evmHexToTron(readWord(input, rowStart + 32)),
        amount,
        token: evmHexToTron(readWord(input, rowStart + 96)),
        amountText: tokenMeta ? `${formatUnits(amount, tokenMeta.decimals)} ${tokenMeta.symbol}` : String(amount)
      });
    }
  }

  return {
    method: "execute(bytes,bytes[],uint256)",
    methodId: METHOD_ID_EXECUTE,
    command: commands === "0d" ? "PERMIT2_TRANSFER_FROM_BATCH" : `0x${commands}`,
    deadline,
    transfers
  };
}

export function encodeBatchTransferInput(details) {
  const rows = details
    .map((detail) => {
      return [
        encodeAddress(detail.from),
        encodeAddress(detail.to),
        encodeUint(detail.amount),
        encodeAddress(detail.token)
      ].join("");
    })
    .join("");
  return `${encodeUint(32n)}${encodeUint(BigInt(details.length))}${rows}`;
}

async function readTrc20Balance(tokenAddress, ownerAddress) {
  const readers = [
    () => readBalanceFromWalletContract(tokenAddress, ownerAddress),
    () => readBalanceFromWalletNode(tokenAddress, ownerAddress),
    () => readBalanceFromPublicNode(tokenAddress, ownerAddress)
  ];

  let lastError = null;
  for (const reader of readers) {
    try {
      const value = await reader();
      if (value !== null && value !== undefined) return value;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Token 余额读取失败。");
}

async function readBalanceFromWalletContract(tokenAddress, ownerAddress) {
  const contract = await getTokenContract(tokenAddress);
  const raw = await contract.balanceOf(ownerAddress).call();
  return toBigInt(raw);
}

async function readBalanceFromWalletNode(tokenAddress, ownerAddress) {
  const tronWeb = getTronWeb();
  if (!tronWeb?.transactionBuilder?.triggerConstantContract) {
    throw new Error("钱包节点不支持 constant contract 查询。");
  }

  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    tokenAddress,
    "balanceOf(address)",
    {},
    [{ type: "address", value: ownerAddress }],
    ownerAddress
  );
  return parseConstantResult(result);
}

async function readBalanceFromPublicNode(tokenAddress, ownerAddress) {
  const body = {
    owner_address: addressToTronHex(ownerAddress),
    contract_address: addressToTronHex(tokenAddress),
    function_selector: "balanceOf(address)",
    parameter: encodeAddress(ownerAddress),
    visible: false
  };

  let lastError = null;
  const nodeUrls = getPublicNodeOrder();
  for (const nodeUrl of nodeUrls) {
    try {
      const response = await fetchWithTimeout(`${nodeUrl}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (response.status === 429) throw new Error(`${nodeUrl} 请求过多，已切换下一个节点。`);
      if (!response.ok) throw new Error(`${nodeUrl} 余额查询失败：${response.status}`);
      rememberPublicNode(nodeUrl);
      return parseConstantResult(await response.json());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("公共节点余额查询失败。");
}

async function estimateContractCall({
  ownerAddress,
  contractAddress,
  functionSelector,
  parameter,
  fallbackEnergy,
  fallbackBandwidth
}) {
  const body = {
    owner_address: addressToTronHex(ownerAddress),
    contract_address: addressToTronHex(contractAddress),
    function_selector: functionSelector,
    parameter,
    visible: false
  };
  const fallback = {
    energy: fallbackEnergy,
    bandwidth: fallbackBandwidth,
    source: "fallback"
  };

  const walletResult = await postWalletNode("wallet/estimateenergy", body).catch(() => null);
  const walletEstimate = parseEnergyEstimate(walletResult);
  if (walletEstimate) {
    return {
      energy: walletEstimate,
      bandwidth: estimateBandwidthFromPayload(functionSelector, parameter),
      source: "wallet estimateenergy"
    };
  }

  const publicResult = await postPublicNode("wallet/estimateenergy", body).catch(() => null);
  const publicEstimate = parseEnergyEstimate(publicResult);
  if (publicEstimate) {
    return {
      energy: publicEstimate,
      bandwidth: estimateBandwidthFromPayload(functionSelector, parameter),
      source: "public estimateenergy"
    };
  }

  const constantResult =
    await postWalletNode("wallet/triggerconstantcontract", body).catch(() => null) ||
    await postPublicNode("wallet/triggerconstantcontract", body).catch(() => null);
  const constantEstimate = parseEnergyEstimate(constantResult);
  if (constantEstimate) {
    return {
      energy: constantEstimate,
      bandwidth: estimateBandwidthFromPayload(functionSelector, parameter),
      source: "triggerconstantcontract"
    };
  }

  return fallback;
}

async function getContractResourceInfo(contractAddress) {
  const body = {
    value: addressToTronHex(contractAddress),
    visible: false
  };
  const result =
    await postWalletNode("wallet/getcontract", body).catch(() => null) ||
    await postPublicNode("wallet/getcontract", body).catch(() => null);
  const contract = result?.contract_address ? result : null;
  const userResourcePercent =
    contract?.consume_user_resource_percent ??
    contract?.consumeUserResourcePercent ??
    contract?.consume_user_resource_percent_v2 ??
    null;
  const originEnergyLimit = contract?.origin_energy_limit ?? contract?.originEnergyLimit ?? null;

  return {
    userResourcePercent: userResourcePercent === null ? null : Number(userResourcePercent),
    originEnergyLimit: originEnergyLimit === null ? null : Number(originEnergyLimit),
    source: contract ? "wallet/getcontract" : "fallback"
  };
}

async function postWalletNode(path, body) {
  const tronWeb = getTronWeb();
  const host = getNodeHost(tronWeb?.fullNode);
  if (!host) throw new Error("钱包节点不可用。");
  const response = await fetchWithTimeout(`${host}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`钱包节点 ${path} 失败：${response.status}`);
  return response.json();
}

async function postPublicNode(path, body) {
  let lastError = null;
  for (const nodeUrl of getPublicNodeOrder()) {
    try {
      const response = await fetchWithTimeout(`${nodeUrl}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (response.status === 429) throw new Error(`${nodeUrl} 请求过多，已切换下一个节点。`);
      if (!response.ok) throw new Error(`${nodeUrl} ${path} 失败：${response.status}`);
      rememberPublicNode(nodeUrl);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`公共节点 ${path} 失败。`);
}

function getPublicNodeOrder() {
  const nodes = APP_CONFIG.publicFullNodes || [];
  return [...nodes.slice(publicNodeCursor), ...nodes.slice(0, publicNodeCursor)];
}

function rememberPublicNode(nodeUrl) {
  const index = (APP_CONFIG.publicFullNodes || []).indexOf(nodeUrl);
  if (index >= 0) publicNodeCursor = index;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APP_CONFIG.publicNodeTimeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getNodeHost(node) {
  if (!node) return "";
  if (typeof node === "string") return node.replace(/\/$/, "");
  const host = node.fullHost || node.host || node.fullNode || node.node;
  return host ? String(host).replace(/\/$/, "") : "";
}

function parseEnergyEstimate(result) {
  const value =
    result?.energy_required ??
    result?.energyRequired ??
    result?.energy_used ??
    result?.energyUsed ??
    result?.energy_penalty_total ??
    null;
  if (value === null || value === undefined) return null;
  const energy = Number(value);
  return Number.isFinite(energy) && energy > 0 ? energy : null;
}

function estimateBandwidthFromPayload(functionSelector, parameter) {
  const selectorBytes = 4;
  const parameterBytes = Math.ceil(stripHex(parameter).length / 2);
  const envelopeBytes = 240;
  const signatureBytes = 67;
  const functionSelectorBytes = new TextEncoder().encode(functionSelector).length;
  return selectorBytes + parameterBytes + envelopeBytes + signatureBytes + functionSelectorBytes;
}

function encodeExecuteArgs(commandsHex, inputsHex, deadline) {
  const commands = encodeBytes(commandsHex);
  const inputs = encodeBytesArray(inputsHex);
  const commandsOffset = 96n;
  const inputsOffset = commandsOffset + BigInt(commands.length / 2);
  return [
    encodeUint(commandsOffset),
    encodeUint(inputsOffset),
    encodeUint(deadline),
    commands,
    inputs
  ].join("");
}

function encodeBytesArray(items) {
  const encodedItems = items.map(encodeBytes);
  let nextOffset = BigInt(items.length * 32);
  const offsets = encodedItems.map((item) => {
    const offset = nextOffset;
    nextOffset += BigInt(item.length / 2);
    return encodeUint(offset);
  });
  return `${encodeUint(BigInt(items.length))}${offsets.join("")}${encodedItems.join("")}`;
}

function encodeBytes(hex) {
  const clean = stripHex(hex);
  const paddedLength = Math.ceil(clean.length / 64) * 64;
  return `${encodeUint(BigInt(clean.length / 2))}${clean.padEnd(paddedLength, "0")}`;
}

function encodeUint(value) {
  const bigint = BigInt(value);
  if (bigint < 0n) throw new Error("uint cannot be negative");
  return bigint.toString(16).padStart(64, "0");
}

function encodeAddress(address) {
  const hex = addressToEvmHex(address);
  return hex.padStart(64, "0");
}

function readWord(hex, offsetBytes) {
  return hex.slice(offsetBytes * 2, offsetBytes * 2 + 64);
}

function readUint(hex, offsetBytes) {
  return BigInt(`0x${readWord(hex, offsetBytes) || "0"}`);
}

function readBytes(hex, offsetBytes) {
  const length = Number(readUint(hex, offsetBytes));
  const start = (offsetBytes + 32) * 2;
  return hex.slice(start, start + length * 2);
}

function addressToEvmHex(address) {
  const clean = stripHex(String(address || ""));
  if (/^41[0-9a-fA-F]{40}$/.test(clean)) return clean.slice(2).toLowerCase();
  if (/^[0-9a-fA-F]{40}$/.test(clean)) return clean.toLowerCase();
  const tronWeb = getTronWeb();
  if (tronWeb?.address?.toHex) {
    const tronHex = tronWeb.address.toHex(address);
    return stripHex(tronHex).slice(2).toLowerCase();
  }
  return base58ToHex(address).slice(2, 42).toLowerCase();
}

function addressToTronHex(address) {
  const clean = stripHex(String(address || ""));
  if (/^41[0-9a-fA-F]{40}$/.test(clean)) return clean.toLowerCase();
  if (/^[0-9a-fA-F]{40}$/.test(clean)) return `41${clean.toLowerCase()}`;
  const tronWeb = getTronWeb();
  if (tronWeb?.address?.toHex) return stripHex(tronWeb.address.toHex(address)).toLowerCase();
  return base58ToHex(address).slice(0, 42).toLowerCase();
}

function evmHexToTron(word) {
  const clean = stripHex(word).slice(-40);
  const hex = `41${clean}`;
  return getTronWeb()?.address?.fromHex ? getTronWeb().address.fromHex(hex) : hexToBase58Check(hex);
}

function stripHex(value) {
  return String(value).replace(/^0x/i, "");
}

function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return 0n;
    if (clean.startsWith("0x")) return BigInt(clean);
    if (/^[0-9a-fA-F]{64}$/.test(clean)) return BigInt(`0x${clean}`);
    if (/^[0-9a-fA-F]+$/.test(clean) && /[a-fA-F]/.test(clean)) return BigInt(`0x${clean}`);
    return BigInt(clean);
  }
  if (value?._hex) return BigInt(value._hex);
  if (Array.isArray(value) && value.length === 1) return toBigInt(value[0]);
  if (value?.toString) return BigInt(value.toString());
  return 0n;
}

function parseConstantResult(result) {
  const constantResult = result?.constant_result ?? result?.constantResult ?? result?.transaction?.ret?.constant_result;
  const raw = Array.isArray(constantResult) ? constantResult[0] : constantResult;
  if (!raw) {
    const message = result?.result?.message || result?.message || "constant contract 查询没有返回结果。";
    throw new Error(message);
  }
  return BigInt(`0x${stripHex(raw)}`);
}

function parsePermit2Allowance(raw) {
  const amount = raw?.amount ?? raw?.[0] ?? 0;
  const expiration = raw?.expiration ?? raw?.[1] ?? 0;
  const nonce = raw?.nonce ?? raw?.[2] ?? 0;
  return {
    amount: toBigInt(amount),
    expiration: Number(toBigInt(expiration)),
    nonce: Number(toBigInt(nonce))
  };
}

function base58ToHex(value) {
  let num = 0n;
  for (const char of value) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base58 address");
    num = num * 58n + BigInt(index);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  for (const char of value) {
    if (char === "1") hex = `00${hex}`;
    else break;
  }
  return hex;
}

function hexToBase58Check(hex) {
  const bytes = hexToBytes(hex);
  const checksum = doubleSha256(bytes).slice(0, 4);
  return base58Encode([...bytes, ...checksum]);
}

function hexToBytes(hex) {
  const clean = stripHex(hex);
  const bytes = [];
  for (let index = 0; index < clean.length; index += 2) {
    bytes.push(parseInt(clean.slice(index, index + 2), 16));
  }
  return bytes;
}

function base58Encode(bytes) {
  let num = 0n;
  for (const byte of bytes) {
    num = (num << 8n) + BigInt(byte);
  }
  let encoded = "";
  while (num > 0n) {
    const mod = Number(num % 58n);
    encoded = ALPHABET[mod] + encoded;
    num /= 58n;
  }
  for (const byte of bytes) {
    if (byte === 0) encoded = `${ALPHABET[0]}${encoded}`;
    else break;
  }
  return encoded;
}

function doubleSha256(bytes) {
  const first = sha256(bytes);
  return sha256(first);
}

function sha256(bytes) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const message = [...bytes, 0x80];
  while ((message.length % 64) !== 56) message.push(0);
  const bitLength = bytes.length * 8;
  for (let shift = 56; shift >= 0; shift -= 8) message.push((bitLength / 2 ** shift) & 0xff);

  for (let chunk = 0; chunk < message.length; chunk += 64) {
    const words = new Array(64).fill(0);
    for (let index = 0; index < 16; index += 1) {
      const start = chunk + index * 4;
      words[index] =
        (message[start] << 24) | (message[start + 1] << 16) | (message[start + 2] << 8) | message[start + 3];
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.flatMap((word) => [(word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff]);
}
