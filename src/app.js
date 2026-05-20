import { APP_CONFIG, TOKENS } from "./tokens.js";
import {
  approvePermit2,
  broadcastRouterTransfer,
  buildRouterTransfer,
  calculateSavings,
  connectTronLink,
  estimateTransferResources,
  formatUnits,
  getRouterAllowance,
  getTokenAllowance,
  getTokenBalance,
  parseRouterTransferData,
  parseUnits,
  shortAddress,
  tronscanAddressUrl,
  tronscanTxUrl,
  validateAddress
} from "./tron.js";

const initialTokens = TOKENS.map((token) => ({ ...token, balance: null }));

const state = {
  account: "",
  token: initialTokens[0],
  tokens: initialTokens,
  tokenAllowance: 0n,
  routerAllowance: 0n,
  routerAllowanceExpiration: 0,
  amount: 0n,
  action: "connect",
  currentCalldata: "",
  currentDeadline: 0n,
  decodedData: null
};

const els = {
  walletPill: document.querySelector("#walletPill"),
  walletLabel: document.querySelector("#walletLabel"),
  connectBtn: document.querySelector("#connectBtn"),
  tokenButton: document.querySelector("#tokenButton"),
  tokenMenu: document.querySelector("#tokenMenu"),
  tokenFace: document.querySelector("#tokenFace"),
  tokenSymbol: document.querySelector("#tokenSymbol"),
  tokenName: document.querySelector("#tokenName"),
  selectedBalance: document.querySelector("#selectedBalance"),
  recipientInput: document.querySelector("#recipientInput"),
  amountInput: document.querySelector("#amountInput"),
  maxBtn: document.querySelector("#maxBtn"),
  primaryBtn: document.querySelector("#primaryBtn"),
  transferForm: document.querySelector("#transferForm"),
  totalPreview: document.querySelector("#totalPreview"),
  inlineSave: document.querySelector("#inlineSave"),
  allowanceState: document.querySelector("#allowanceState"),
  approvalNotice: document.querySelector("#approvalNotice"),
  approvalDescription: document.querySelector("#approvalDescription"),
  permit2Link: document.querySelector("#permit2Link"),
  routerLink: document.querySelector("#routerLink"),
  approvalModal: document.querySelector("#approvalModal"),
  closeApprovalModal: document.querySelector("#closeApprovalModal"),
  cancelApprovalBtn: document.querySelector("#cancelApprovalBtn"),
  confirmApprovalBtn: document.querySelector("#confirmApprovalBtn"),
  approvalAmountInput: document.querySelector("#approvalAmountInput"),
  approvalExactBtn: document.querySelector("#approvalExactBtn"),
  modalPermit2Link: document.querySelector("#modalPermit2Link"),
  modalRouterLink: document.querySelector("#modalRouterLink"),
  approvalModalNote: document.querySelector("#approvalModalNote"),
  txModal: document.querySelector("#txModal"),
  closeTxModal: document.querySelector("#closeTxModal"),
  cancelTxBtn: document.querySelector("#cancelTxBtn"),
  confirmTxBtn: document.querySelector("#confirmTxBtn"),
  txTokenFace: document.querySelector("#txTokenFace"),
  txAmountSummary: document.querySelector("#txAmountSummary"),
  txSubsidySummary: document.querySelector("#txSubsidySummary"),
  classicCostEstimate: document.querySelector("#classicCostEstimate"),
  classicEnergyEstimate: document.querySelector("#classicEnergyEstimate"),
  classicUserEstimate: document.querySelector("#classicUserEstimate"),
  classicBandwidthEstimate: document.querySelector("#classicBandwidthEstimate"),
  currentCostEstimate: document.querySelector("#currentCostEstimate"),
  currentEnergyEstimate: document.querySelector("#currentEnergyEstimate"),
  currentUserEstimate: document.querySelector("#currentUserEstimate"),
  currentBandwidthEstimate: document.querySelector("#currentBandwidthEstimate"),
  savedEnergyEstimate: document.querySelector("#savedEnergyEstimate"),
  savedPercentEstimate: document.querySelector("#savedPercentEstimate"),
  savedBandwidthEstimate: document.querySelector("#savedBandwidthEstimate"),
  savedCostEstimate: document.querySelector("#savedCostEstimate"),
  txRouterLink: document.querySelector("#txRouterLink"),
  txDecodedMethod: document.querySelector("#txDecodedMethod"),
  txDecodedCommand: document.querySelector("#txDecodedCommand"),
  txDecodedDeadline: document.querySelector("#txDecodedDeadline"),
  txDecodedTransfers: document.querySelector("#txDecodedTransfers"),
  messageBox: document.querySelector("#messageBox"),
  baselineEnergy: document.querySelector("#baselineEnergy"),
  routerEnergy: document.querySelector("#routerEnergy"),
  savePercent: document.querySelector("#savePercent"),
  saveUsd: document.querySelector("#saveUsd"),
  saveTrx: document.querySelector("#saveTrx")
};

init();

function init() {
  renderEnergy();
  renderTokens();
  renderSelectedToken();
  updatePreview();

  els.connectBtn.addEventListener("click", connect);
  els.tokenButton.addEventListener("click", toggleTokenMenu);
  els.amountInput.addEventListener("input", updatePreview);
  els.recipientInput.addEventListener("input", updatePreview);
  els.maxBtn.addEventListener("click", fillMax);
  els.transferForm.addEventListener("submit", handlePrimaryAction);
  els.closeApprovalModal.addEventListener("click", closeApprovalModal);
  els.cancelApprovalBtn.addEventListener("click", closeApprovalModal);
  els.approvalModal.addEventListener("click", closeApprovalModalFromBackdrop);
  els.confirmApprovalBtn.addEventListener("click", confirmApproval);
  els.approvalExactBtn.addEventListener("click", fillExactApprovalAmount);
  els.approvalAmountInput.addEventListener("input", updateApprovalConfirmState);
  els.closeTxModal.addEventListener("click", closeTxModal);
  els.cancelTxBtn.addEventListener("click", closeTxModal);
  els.txModal.addEventListener("click", closeTxModalFromBackdrop);
  els.confirmTxBtn.addEventListener("click", send);
  document.addEventListener("click", closeTokenMenu);

  els.permit2Link.href = tronscanAddressUrl(APP_CONFIG.permit2);
  els.routerLink.href = tronscanAddressUrl(APP_CONFIG.universalRouter);
  els.modalPermit2Link.href = tronscanAddressUrl(APP_CONFIG.permit2);
  els.modalPermit2Link.textContent = APP_CONFIG.permit2;
  els.modalRouterLink.href = tronscanAddressUrl(APP_CONFIG.universalRouter);
  els.modalRouterLink.textContent = APP_CONFIG.universalRouter;
  els.txRouterLink.href = tronscanAddressUrl(APP_CONFIG.universalRouter);
  els.txRouterLink.textContent = APP_CONFIG.universalRouter;

  if (window.tronWeb?.defaultAddress?.base58) {
    state.account = window.tronWeb.defaultAddress.base58;
    refreshWallet();
    refreshOnchainState();
  }
}

function renderEnergy() {
  const savings = calculateSavings();
  const currentUserEnergy = Math.ceil(APP_CONFIG.energy.routerTransfer * APP_CONFIG.energy.routerUserPercent / 100);
  els.baselineEnergy.textContent = APP_CONFIG.energy.classicTransfer.toLocaleString();
  els.routerEnergy.textContent = currentUserEnergy.toLocaleString();
  els.savePercent.textContent = `${savings.percent.toFixed(2)}%`;
  els.saveUsd.textContent = `约 $${savings.savedUsd.toFixed(2)}，按 1% 补贴后承担估算`;
  els.saveTrx.textContent = `${savings.savedTrx.toFixed(2)} TRX`;
  els.inlineSave.textContent = `${savings.savedTrx.toFixed(2)} TRX`;
}

function renderTokens() {
  els.tokenMenu.innerHTML = state.tokens
    .map((token) => {
      const balance = formatBalance(token);
      return `
        <button class="token-option" type="button" role="option" data-address="${token.address}">
          ${token.logoURI ? `<img src="${token.logoURI}" alt="" />` : `<span>${token.symbol.slice(0, 2)}</span>`}
          <span>
            <strong>${token.symbol}</strong>
            <small>${token.name}</small>
          </span>
          <em>${balance}</em>
        </button>
      `;
    })
    .join("");

  els.tokenMenu.querySelectorAll(".token-option").forEach((button) => {
    button.addEventListener("click", () => {
      state.token = state.tokens.find((token) => token.address === button.dataset.address);
      els.tokenMenu.classList.remove("open");
      renderSelectedToken();
      refreshOnchainState();
      updatePreview();
    });
  });
}

function renderSelectedToken() {
  const { token } = state;
  els.tokenSymbol.textContent = token.symbol;
  els.tokenName.textContent = token.name;
  els.selectedBalance.textContent = `余额 ${formatBalance(token)}`;
  els.tokenFace.innerHTML = token.logoURI ? `<img src="${token.logoURI}" alt="" />` : token.symbol.slice(0, 2);
}

async function connect() {
  try {
    setMessage("正在连接 TronLink...");
    const { address } = await connectTronLink();
    state.account = address;
    refreshWallet();
    await refreshOnchainState();
    setMessage("钱包已连接，已自动检测余额和授权。", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function refreshWallet() {
  els.walletPill.classList.toggle("connected", Boolean(state.account));
  els.walletLabel.textContent = state.account ? shortAddress(state.account) : "未连接钱包";
  els.connectBtn.textContent = state.account ? shortAddress(state.account) : "连接 TronLink";
}

async function refreshOnchainState() {
  if (!state.account) {
    updatePreview();
    return;
  }

  await Promise.all([refreshBalances(), refreshAllowance()]);
  renderTokens();
  renderSelectedToken();
  updatePreview();
}

async function refreshBalances() {
  for (const token of state.tokens) {
    try {
      token.balance = await getTokenBalance(token.address, state.account);
      renderTokens();
      renderSelectedToken();
    } catch {
      token.balance = null;
    }
  }
}

async function refreshAllowance() {
  try {
    const [tokenAllowance, routerAllowance] = await Promise.all([
      getTokenAllowance(state.token.address, state.account),
      getRouterAllowance(state.token.address, state.account)
    ]);
    state.tokenAllowance = tokenAllowance;
    state.routerAllowance = routerAllowance.amount;
    state.routerAllowanceExpiration = routerAllowance.expiration;
  } catch {
    state.tokenAllowance = 0n;
    state.routerAllowance = 0n;
    state.routerAllowanceExpiration = 0;
  }
}

function updatePreview() {
  const amountText = els.amountInput.value.trim();
  const recipient = els.recipientInput.value.trim();
  const form = parseFormAmount(amountText);
  state.amount = form.amount;
  els.totalPreview.textContent = form.valid
    ? `${formatUnits(form.amount, state.token.decimals)} ${state.token.symbol}`
    : `0 ${state.token.symbol}`;

  const recipientReady = Boolean(recipient && validateAddress(recipient));
  const amountReady = form.valid && form.amount > 0n;
  const balanceReady = state.token.balance === null || state.token.balance >= form.amount;
  const allowanceReady = hasEnoughAllowance(form.amount);

  clearTransactionData();
  closeTxModal();
  els.approvalNotice.hidden = true;

  if (!state.account) {
    setPrimary("connect", "连接 TronLink", false);
    els.allowanceState.textContent = "连接后检测";
    return;
  }

  if (!amountText || !amountReady) {
    setPrimary("idle", "填写转账信息", true);
    els.allowanceState.textContent = "等待数量";
    return;
  }

  if (!form.valid) {
    setPrimary("idle", form.error, true);
    els.allowanceState.textContent = "数量无效";
    return;
  }

  if (!balanceReady) {
    setPrimary("idle", "余额不足", true);
    els.allowanceState.textContent = "余额不足";
    return;
  }

  if (!recipientReady) {
    setPrimary("idle", "填写有效收款地址", true);
    els.allowanceState.textContent = allowanceReady ? "已授权" : "需要授权";
    renderApprovalNotice(form.amount, allowanceReady);
    return;
  }

  const transfer = buildRouterTransfer({
    ownerAddress: state.account,
    recipient,
    tokenAddress: state.token.address,
    amount: form.amount
  });
  state.currentCalldata = transfer.calldata;
  state.currentDeadline = transfer.deadline;
  state.decodedData = parseRouterTransferData(transfer.calldata, state.token);

  if (!allowanceReady) {
    setPrimary("approve", `授权 ${formatUnits(form.amount, state.token.decimals)} ${state.token.symbol}`, false);
    els.allowanceState.textContent = "需要授权";
    renderApprovalNotice(form.amount, false);
    return;
  }

  setPrimary("send", "转账", false);
  els.allowanceState.textContent = "已授权";
}

async function handlePrimaryAction(event) {
  event.preventDefault();
  if (state.action === "connect") {
    await connect();
    return;
  }
  if (state.action === "approve") {
    openApprovalModal();
    return;
  }
  if (state.action === "send") {
    openTxModal();
  }
}

function openApprovalModal() {
  const amount = parseFormAmount(els.amountInput.value.trim()).amount;
  els.approvalAmountInput.value = formatUnits(amount, state.token.decimals, state.token.decimals);
  els.approvalModalNote.textContent = `当前转账需要授权至少 ${formatUnits(amount, state.token.decimals)} ${state.token.symbol}。确认后钱包可能依次弹出两笔授权签名。`;
  els.approvalModal.hidden = false;
  updateApprovalConfirmState();
  els.approvalAmountInput.focus();
}

function closeApprovalModal() {
  els.approvalModal.hidden = true;
}

function closeApprovalModalFromBackdrop(event) {
  if (event.target === els.approvalModal) closeApprovalModal();
}

function fillExactApprovalAmount() {
  els.approvalAmountInput.value = formatUnits(state.amount, state.token.decimals, state.token.decimals);
  updateApprovalConfirmState();
}

function updateApprovalConfirmState() {
  try {
    const amount = parseUnits(els.approvalAmountInput.value, state.token.decimals);
    els.confirmApprovalBtn.disabled = amount < state.amount || amount <= 0n;
    els.approvalModalNote.dataset.type = amount < state.amount ? "error" : "";
    if (amount < state.amount) {
      els.approvalModalNote.textContent = `授权金额不能低于当前转账数量 ${formatUnits(state.amount, state.token.decimals)} ${state.token.symbol}。`;
    } else {
      els.approvalModalNote.textContent = `只会授权 ${formatUnits(amount, state.token.decimals)} ${state.token.symbol}。确认后钱包可能依次弹出两笔授权签名。`;
    }
  } catch (error) {
    els.confirmApprovalBtn.disabled = true;
    els.approvalModalNote.dataset.type = "error";
    els.approvalModalNote.textContent = error.message;
  }
}

async function confirmApproval() {
  try {
    const amount = parseUnits(els.approvalAmountInput.value, state.token.decimals);
    if (amount < state.amount) throw new Error("授权金额不能低于当前转账数量。");
    els.confirmApprovalBtn.disabled = true;
    setMessage(`请求授权指定金额：${formatUnits(amount, state.token.decimals)} ${state.token.symbol}`);
    const result = await approvePermit2(state.token.address, state.account, amount);
    const txids = [result.tokenApprovalTx, result.routerApprovalTx].filter(Boolean);
    setMessage(`授权交易已提交：${txids.map((txid) => `<a href="${tronscanTxUrl(txid)}" target="_blank" rel="noreferrer">${shortAddress(txid)}</a>`).join(" / ") || "额度已足够"}`, "success", true);
    closeApprovalModal();
    await delay(1200);
    await refreshAllowance();
    updatePreview();
  } catch (error) {
    setMessage(error.message, "error");
    els.confirmApprovalBtn.disabled = false;
  }
}

async function send() {
  try {
    const recipient = els.recipientInput.value.trim();
    const amount = parseUnits(els.amountInput.value, state.token.decimals);
    if (!validateAddress(recipient)) throw new Error("收款地址格式不正确。");
    if (!hasEnoughAllowance(amount)) throw new Error("授权额度不足，请先授权指定金额。");
    if (!state.currentCalldata || !state.currentDeadline) throw new Error("请先确认交易 data。");

    els.confirmTxBtn.disabled = true;
    setMessage("正在构造转账并请求签名...");
    const result = await broadcastRouterTransfer({
      ownerAddress: state.account,
      recipient,
      tokenAddress: state.token.address,
      amount,
      deadline: state.currentDeadline
    });
    const txid = result.txid || result.transaction?.txID || "";
    setMessage(txid ? `转账已提交：<a href="${tronscanTxUrl(txid)}" target="_blank" rel="noreferrer">${txid}</a>` : "转账已提交。", "success", true);
    closeTxModal();
    await refreshOnchainState();
  } catch (error) {
    setMessage(error.message, "error");
    els.confirmTxBtn.disabled = false;
  }
}

function renderApprovalNotice(amount, allowanceReady) {
  if (allowanceReady || !amount) return;
  els.approvalNotice.hidden = false;
  els.approvalDescription.textContent = `授权额度：${formatUnits(amount, state.token.decimals)} ${state.token.symbol}。请核验 Permit2 与 UniversalRouter 地址。`;
}

function openTxModal() {
  try {
    const recipient = els.recipientInput.value.trim();
    const amount = parseUnits(els.amountInput.value, state.token.decimals);
    if (!validateAddress(recipient)) throw new Error("收款地址格式不正确。");
    if (!hasEnoughAllowance(amount)) throw new Error("授权额度不足，请先授权指定金额。");

    const transfer = buildRouterTransfer({
      ownerAddress: state.account,
      recipient,
      tokenAddress: state.token.address,
      amount
    });
    state.amount = amount;
    state.currentCalldata = transfer.calldata;
    state.currentDeadline = transfer.deadline;
    state.decodedData = parseRouterTransferData(transfer.calldata, state.token);
    renderTxDecodedData(state.decodedData);
    renderResourceEstimate(null, true);
    els.confirmTxBtn.disabled = false;
    els.txModal.hidden = false;
    estimateTransferResources({
      ownerAddress: state.account,
      recipient,
      tokenAddress: state.token.address,
      amount,
      calldata: transfer.calldata
    })
      .then((estimate) => renderResourceEstimate(estimate))
      .catch(() => renderResourceEstimate(null, false));
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function closeTxModal() {
  els.txModal.hidden = true;
  els.confirmTxBtn.disabled = false;
}

function closeTxModalFromBackdrop(event) {
  if (event.target === els.txModal) closeTxModal();
}

function renderTxDecodedData(decoded) {
  const transfer = decoded.transfers[0];
  const savings = calculateSavings();
  els.txTokenFace.innerHTML = state.token.logoURI ? `<img src="${state.token.logoURI}" alt="" />` : state.token.symbol.slice(0, 2);
  els.txAmountSummary.textContent = transfer?.amountText || `${formatUnits(state.amount, state.token.decimals)} ${state.token.symbol}`;
  els.txSubsidySummary.textContent = `预计通过 SunSwap 补贴少花约 ${savings.savedTrx.toFixed(2)} TRX`;
  els.txDecodedMethod.textContent = decoded.method;
  els.txDecodedCommand.textContent = decoded.command;
  els.txDecodedDeadline.textContent = formatDeadline(decoded.deadline);
  els.txDecodedTransfers.innerHTML = decoded.transfers
    .map((transfer) => {
      return `
        <div class="transfer-row">
          <div>
            <span>From</span>
            <a href="${tronscanAddressUrl(transfer.from)}" target="_blank" rel="noreferrer">${transfer.from}</a>
          </div>
          <div>
            <span>To</span>
            <a href="${tronscanAddressUrl(transfer.to)}" target="_blank" rel="noreferrer">${transfer.to}</a>
          </div>
          <div>
            <span>Token</span>
            <a href="${tronscanAddressUrl(transfer.token)}" target="_blank" rel="noreferrer">${state.token.symbol} · ${transfer.token}</a>
          </div>
          <div>
            <span>Amount</span>
            <strong>${transfer.amountText}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderResourceEstimate(estimate, loading = false) {
  if (loading) {
    els.classicCostEstimate.textContent = "-- TRX";
    els.classicEnergyEstimate.textContent = "消耗 -- energy";
    els.classicUserEstimate.textContent = "用户 -- energy";
    els.classicBandwidthEstimate.textContent = "-- bandwidth";
    els.currentCostEstimate.textContent = "-- TRX";
    els.currentEnergyEstimate.textContent = "消耗 -- energy";
    els.currentUserEstimate.textContent = "用户 -- energy";
    els.currentBandwidthEstimate.textContent = "-- bandwidth";
    els.savedCostEstimate.textContent = "-- TRX";
    els.savedEnergyEstimate.textContent = "少承担 -- energy";
    els.savedPercentEstimate.textContent = "--";
    els.savedBandwidthEstimate.textContent = "-- bandwidth";
    return;
  }

  const data = estimate || fallbackResourceEstimate();
  els.classicCostEstimate.textContent = `${formatSun(data.classic.totalSun)} TRX`;
  els.classicEnergyEstimate.textContent = `消耗 ${formatNumber(data.classic.energy)} energy`;
  els.classicUserEstimate.textContent = `用户 ${formatNumber(data.classic.userEnergy)} energy · ${formatPercent(data.classic.userPercent)}`;
  els.classicBandwidthEstimate.textContent = `${formatNumber(data.classic.bandwidth)} bandwidth`;
  els.currentCostEstimate.textContent = `${formatSun(data.router.totalSun)} TRX`;
  els.currentEnergyEstimate.textContent = `消耗 ${formatNumber(data.router.energy)} energy`;
  els.currentUserEstimate.textContent = `用户 ${formatNumber(data.router.userEnergy)} energy · ${formatPercent(data.router.userPercent)}`;
  els.currentBandwidthEstimate.textContent = `${formatNumber(data.router.bandwidth)} bandwidth`;
  els.savedCostEstimate.textContent = `${formatSun(data.saved.sun)} TRX`;
  els.savedEnergyEstimate.textContent = `少承担 ${formatNumber(data.saved.energy)} energy`;
  els.savedPercentEstimate.textContent = `节省 ${formatPercent(getSavedPercent(data))}`;
  els.savedBandwidthEstimate.textContent = `${formatNumber(data.saved.bandwidth)} bandwidth`;
  els.txSubsidySummary.textContent = `预计少花 ${formatSun(data.saved.sun)} TRX`;
}

function fallbackResourceEstimate() {
  const classicEnergy = Math.ceil(APP_CONFIG.energy.classicTransfer * APP_CONFIG.energy.classicUserPercent / 100);
  const routerEnergy = Math.ceil(APP_CONFIG.energy.routerTransfer * APP_CONFIG.energy.routerUserPercent / 100);
  const classicTotalSun = classicEnergy * APP_CONFIG.energy.sunPerEnergy + APP_CONFIG.energy.classicBandwidth * APP_CONFIG.energy.sunPerBandwidth;
  const routerTotalSun = routerEnergy * APP_CONFIG.energy.sunPerEnergy + APP_CONFIG.energy.routerBandwidth * APP_CONFIG.energy.sunPerBandwidth;
  return {
    classic: {
      energy: APP_CONFIG.energy.classicTransfer,
      userEnergy: classicEnergy,
      userPercent: APP_CONFIG.energy.classicUserPercent,
      bandwidth: APP_CONFIG.energy.classicBandwidth,
      totalSun: classicTotalSun
    },
    router: {
      energy: APP_CONFIG.energy.routerTransfer,
      userEnergy: routerEnergy,
      bandwidth: APP_CONFIG.energy.routerBandwidth,
      totalSun: routerTotalSun,
      userPercent: APP_CONFIG.energy.routerUserPercent
    },
    saved: {
      energy: Math.max(0, classicEnergy - routerEnergy),
      bandwidth: Math.max(0, APP_CONFIG.energy.classicBandwidth - APP_CONFIG.energy.routerBandwidth),
      sun: Math.max(0, classicTotalSun - routerTotalSun)
    },
    source: {
      classic: "fallback",
      router: "fallback"
    }
  };
}

function clearTransactionData() {
  state.currentCalldata = "";
  state.currentDeadline = 0n;
  state.decodedData = null;
}

function hasEnoughAllowance(amount) {
  const now = Math.floor(Date.now() / 1000);
  return state.tokenAllowance >= amount && state.routerAllowance >= amount && state.routerAllowanceExpiration > now + 60;
}

function setPrimary(action, label, disabled) {
  state.action = action;
  els.primaryBtn.textContent = label;
  els.primaryBtn.disabled = disabled;
}

function parseFormAmount(value) {
  if (!value) return { valid: true, amount: 0n, error: "" };
  try {
    return { valid: true, amount: parseUnits(value, state.token.decimals), error: "" };
  } catch (error) {
    return { valid: false, amount: 0n, error: error.message };
  }
}

function fillMax() {
  if (state.token.balance === null) return;
  els.amountInput.value = formatUnits(state.token.balance, state.token.decimals, state.token.decimals);
  updatePreview();
}

function formatBalance(token) {
  if (token.balance === null) return "--";
  return `${formatUnits(token.balance, token.decimals, 6)} ${token.symbol}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatSun(value) {
  return (Number(value || 0) / 1_000_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function getSavedPercent(data) {
  if (!data?.classic?.totalSun) return 0;
  return (data.saved.sun / data.classic.totalSun) * 100;
}

function formatDeadline(deadline) {
  return new Date(Number(deadline) * 1000).toLocaleString();
}

async function copyCalldata() {
  if (!state.currentCalldata) return;
  await navigator.clipboard.writeText(`0x${state.currentCalldata}`);
  setMessage("交易 data 已复制。", "success");
}

function toggleTokenMenu(event) {
  event.stopPropagation();
  els.tokenMenu.classList.toggle("open");
}

function closeTokenMenu(event) {
  if (!event.target.closest(".token-select")) {
    els.tokenMenu.classList.remove("open");
  }
}

function setMessage(message, type = "", html = false) {
  if (html) {
    els.messageBox.innerHTML = message;
  } else {
    els.messageBox.textContent = message;
  }
  els.messageBox.dataset.type = type;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
