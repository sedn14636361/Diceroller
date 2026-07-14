const Players = [
  'HO1 国王 ユリウス・フラウニア', 'HO2 第一王妃 セレティ・フラウニア', 'HO3 第二王妃 セレティ・フラウニア', 'HO4 第一王子 イズガル・フラウニア',
  'HO5 第二王子 ケティ・フラウニア', 'HO6 第三王子 リニス・フラウニア', 'HO7 第一王女 クレシャ・フラウニア', 'HO8 第二王女 セフィーレ・フラウニア',
  'HO9 孤高の騎士 リチャード', 'HO10 不死の騎士 デューク', 'HO11 戦旗の騎士 エリン', 'HO12 見習い預言者 レシア',
  'HO13 霊媒師 ウガラガ', 'HO14 預言者の母 ミレリ', 'HO15 衛兵隊長 ドレンディア', 'HO16 王子の近衛兵 スフィム',
  'HO17 宝石商 カクタス', 'HO18 武器商人 ダンヴァル', 'HO19 古物商 ルヴィン', 'HO20 流浪の旅人 ルファ',
  'HO21 パン屋 コルテス', 'HO22 新聞配達人 セナ', 'HO23 長老 ロウリム', 'HO24 湖の魔女'
];

const playerSettings = {};
Players.forEach((player, index) => {
  const colors = [
    '#007cba', '#27ae60', '#e74c3c', '#f39c12',
    '#9b59b6', '#1abc9c', '#d35400', '#3498db',
    '#e67e22', '#2ecc71', '#8e44ad', '#16a085',
    '#c0392b', '#2980b9', '#f1c40f', '#7f8c8d',
    '#34495e', '#d35400', '#27ae60', '#8e44ad',
    '#f39c12', '#16a085', '#e74c3c', '#3498db'
  ];
  playerSettings[player] = {
    color: colors[index % colors.length],
    injury: 0,
    camp: null
  };
});

const phases = [
  { id: 'general', name: 'フェイズ選択' },
  { id: 'war1', name: '第一戦争フェイズ' },
  { id: 'war2', name: '第二戦争フェイズ' },
  { id: 'warFinal', name: '最終戦争フェイズ' }
];

const warPhaseIds = ['general', 'war1', 'war2', 'warFinal'];

let phaseHistories = {};
let phaseTargets = {};
let phaseTargetLocked = {};

phases.forEach(phase => {
  phaseHistories[phase.id] = [];
  phaseTargets[phase.id] = 0;
  phaseTargetLocked[phase.id] = false;
});

let currentPhaseId = phases[0].id;
let currentMode = 'war';

// Timer mode globals
let timerInterval = null;
let remainingSeconds = 0;
let timerRunning = false;
let timerPhase = '第一交渉フェイズ';
function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function isCritical(value, criticalValues) {
  return criticalValues.includes(value);
}

function flipDiceValue(value) {
  return 7 - value;
}

function createDiceResult(value, criticalValues = []) {
  return {
    value,
    modified: false,
    bonusRoll: null,
    criticalValues: [...criticalValues],
    bonusGenerated: false
  };
}

function createBonusRoll(criticalValues = []) {
  const bonusRoll = createDiceResult(rollD6(), criticalValues);
  bonusRoll.bonusGenerated = true;
  if (isCritical(bonusRoll.value, criticalValues)) {
    bonusRoll.bonusRoll = createBonusRoll(criticalValues);
  }
  return bonusRoll;
}

function sumDiceResult(result) {
  let total = result.value;
  if (result.bonusRoll) {
    total += sumDiceResult(result.bonusRoll);
  }
  return total;
}

function countInjuriesFromResult(result, rollIndex) {
  let injuryCount = 0;
  const isBaseInjury = rollIndex === 0 && !result.bonusGenerated && !result.modified;
  const isFlippedInjury = result.modified;

  if (result.value === 1 && (isBaseInjury || isFlippedInjury)) {
    injuryCount += 1;
  }

  if (result.bonusRoll) {
    injuryCount += countInjuriesFromResult(result.bonusRoll, rollIndex);
  }

  return injuryCount;
}

function applyDiceFlip(result) {
  result.modified = true;
  result.value = flipDiceValue(result.value);
  const criticalValues = result.criticalValues || [];
  result.bonusRoll = isCritical(result.value, criticalValues) ? createBonusRoll(criticalValues) : null;
}

function recalculateRollOutcome(rollLogs, criticalValues, ignoreInjury = false) {
  let total = 0;
  let injuryCount = 0;

  rollLogs.forEach((roll, rollIndex) => {
    roll.forEach(result => {
      total += sumDiceResult(result);
      if (!ignoreInjury) {
        injuryCount += countInjuriesFromResult(result, rollIndex);
      }
    });
  });

  return { total, injuryCount };
}

function recalculatePlayerInjuries() {
  Players.forEach(player => {
    if (playerSettings[player]) {
      playerSettings[player].injury = 0;
    }
  });

  Object.values(phaseHistories).forEach(history => {
    history.forEach(record => {
      if (playerSettings[record.player]) {
        playerSettings[record.player].injury += record.injury || 0;
      }
    });
  });
}

function rollDice(count, criticalValues) {
  let total = 0;
  let injuryCount = 0;
  const rollLogs = [];
  let currentRolls = count;
  let isFirstRoll = true;

  while (currentRolls > 0) {
    const results = [];
    let criticalCount = 0;

    for (let i = 0; i < currentRolls; i++) {
      const value = rollD6();
      const isCrit = isCritical(value, criticalValues);
      results.push({
        value,
        isCrit,
        modified: false,
        bonusRoll: null,
        criticalValues: [...criticalValues],
        bonusGenerated: false
      });

      if (isFirstRoll && value === 1 && !isCrit) {
        injuryCount++;
      }
      if (isCrit) {
        criticalCount++;
      }
    }

    total += results.reduce((sum, r) => sum + r.value, 0);
    rollLogs.push(results);
    currentRolls = criticalCount;
    isFirstRoll = false;
  }

  return { total, rollLogs, injuryCount };
}

function renderLog(rollLogs, targetId = 'log', ignoreInjury = false, criticalValues = [], onDiceClick = null) {
  const logElement = document.getElementById(targetId);
  if (!logElement) return;
  logElement.innerHTML = '';

  function appendDiceResult(result, rollIndex) {
    const diceFace = document.createElement('div');
    const isCrit = isCritical(result.value, criticalValues);
    let faceClass = isCrit ? 'critical' : 'normal';

    // ignoreInjuryがfalseの時（戦争・決闘モード）のみ、1の出目を赤くする
    const isInjury = result.value === 1 && !ignoreInjury && ((rollIndex === 0 && !result.bonusGenerated && !result.modified) || result.modified);
    if (isInjury && (!result.bonusGenerated || result.modified)) {
      faceClass = 'injury';
    }

    diceFace.className = `dice-face ${faceClass}${result.modified ? ' modified' : ''}`;
    if (result.bonusGenerated) {
      diceFace.classList.add('bonus-roll');
    }
    diceFace.textContent = result.value;
    if (typeof onDiceClick === 'function' && !result.modified) {
      diceFace.classList.add('dice-face-clickable');
      diceFace.setAttribute('role', 'button');
      diceFace.setAttribute('tabindex', '0');
      diceFace.title = 'クリックで上下反転';
      diceFace.addEventListener('click', () => {
        onDiceClick(result);
      });
      diceFace.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDiceClick(result);
        }
      });
    }
    logElement.appendChild(diceFace);

    if (result.bonusRoll) {
      const separator = document.createElement('div');
      separator.className = 'dice-bonus-separator';
      separator.textContent = '＋';
      logElement.appendChild(separator);
      appendDiceResult(result.bonusRoll, rollIndex);
    }
  }

  rollLogs.forEach((roll, index) => {
    if (index > 0) {
      const separator = document.createElement('div');
      separator.className = 'roll-separator';
      logElement.appendChild(separator);
    }

    roll.forEach(result => {
      appendDiceResult(result, index);
    });
  });
}

function showRollResultPopup(playerName, rollLogs, total, injury, criticalValues = [], onDiceClick = null, session = null, onRefresh = null) {
  const modal = document.getElementById('roll-result-modal');
  if (!modal) return;
  const flipState = session || { flipUnlocked: false };
  const flipButton = document.getElementById('roll-flip-enable-btn');

  // プレイヤー名を設定
  document.getElementById('roll-player-name').textContent = playerName;
  
  // ダイス結果を表示
  renderLog(rollLogs, 'roll-dice-display', false, criticalValues, flipState.flipUnlocked ? onDiceClick : null);
  
  // 合計と負傷を表示
  document.getElementById('roll-total-value').textContent = total;
  document.getElementById('roll-injury-value').textContent = injury;

  if (flipButton) {
    flipButton.disabled = !!flipState.flipUnlocked;
    flipButton.onclick = () => {
      if (flipState.flipUnlocked) return;
      flipState.flipUnlocked = true;
      flipButton.disabled = true;
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    };
  }
  
  // モーダルを表示
  modal.classList.add('show');
}

function showDuelRollResultPopup(name1, result1, name2, result2, onAfterFlip = null) {
  const modal = document.getElementById('duel-result-modal');
  if (!modal) return;
  const flipButton1 = document.getElementById('duel-flip-enable-btn-1');
  const flipButton2 = document.getElementById('duel-flip-enable-btn-2');

  document.getElementById('duel-modal-player-name-1').textContent = name1;
  document.getElementById('duel-modal-player-name-2').textContent = name2;

  renderLog(result1.rollLogs, 'duel-modal-dice-display-1', false, result1.criticalValues || [], result1.flipUnlocked ? (result) => {
    applyDiceFlip(result);
    updateDuelResultDerivedValues(result1);
    updateDuelResultDerivedValues(result2);
    if (typeof onAfterFlip === 'function') onAfterFlip();
  } : null);
  document.getElementById('duel-modal-total-1').textContent = `${result1.total}`;
  document.getElementById('duel-modal-injury-1').textContent = `${result1.injuryCount}`;

  renderLog(result2.rollLogs, 'duel-modal-dice-display-2', false, result2.criticalValues || [], result2.flipUnlocked ? (result) => {
    applyDiceFlip(result);
    updateDuelResultDerivedValues(result1);
    updateDuelResultDerivedValues(result2);
    if (typeof onAfterFlip === 'function') onAfterFlip();
  } : null);
  document.getElementById('duel-modal-total-2').textContent = `${result2.total}`;
  document.getElementById('duel-modal-injury-2').textContent = `${result2.injuryCount}`;

  if (flipButton1) {
    flipButton1.disabled = !!result1.flipUnlocked;
    flipButton1.onclick = () => {
      if (result1.flipUnlocked) return;
      result1.flipUnlocked = true;
      flipButton1.disabled = true;
      if (typeof onAfterFlip === 'function') onAfterFlip();
    };
  }

  if (flipButton2) {
    flipButton2.disabled = !!result2.flipUnlocked;
    flipButton2.onclick = () => {
      if (result2.flipUnlocked) return;
      result2.flipUnlocked = true;
      flipButton2.disabled = true;
      if (typeof onAfterFlip === 'function') onAfterFlip();
    };
  }

  const resultMsg = document.getElementById('duel-modal-message');
  if (result1.total > result2.total) {
    resultMsg.textContent = `${name1} の勝利！`;
    resultMsg.style.color = '#e74c3c';
  } else if (result2.total > result1.total) {
    resultMsg.textContent = `${name2} の勝利！`;
    resultMsg.style.color = '#007cba';
  } else {
    resultMsg.textContent = '引き分け！';
    resultMsg.style.color = '#333';
  }

  modal.classList.add('show');
}

function showTestRollResultPopup(playerName, rollLogs, total, target, modifier, isSuccess, onDiceClick = null, session = null, onRefresh = null) {
  const modal = document.getElementById('test-result-modal');
  if (!modal) return;
  const flipState = session || { flipUnlocked: false };
  const flipButton = document.getElementById('test-flip-enable-btn');

  document.getElementById('test-modal-player-name').textContent = playerName;
  renderLog(rollLogs, 'test-modal-dice-display', true, [], flipState.flipUnlocked ? onDiceClick : null);

  const finalTotal = total + (isNaN(modifier) ? 0 : modifier);
  document.getElementById('test-modal-total').textContent = String(finalTotal);
  document.getElementById('test-modal-target').textContent = String(target);

  const resultMsg = document.getElementById('test-modal-message');
  if (isSuccess) {
    resultMsg.textContent = '成功！';
    resultMsg.style.color = '#27ae60';
  } else {
    resultMsg.textContent = '失敗…';
    resultMsg.style.color = '#e74c3c';
  }

  if (flipButton) {
    flipButton.disabled = !!flipState.flipUnlocked;
    flipButton.onclick = () => {
      if (flipState.flipUnlocked) return;
      flipState.flipUnlocked = true;
      flipButton.disabled = true;
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    };
  }

  modal.classList.add('show');
}

function updateWarRecordDerivedValues(record) {
  const criticalValues = record.criticalValues || [];
  const outcome = recalculateRollOutcome(record.rollLogs, criticalValues, false);
  record.total = outcome.total;
  record.injury = outcome.injuryCount;
  return outcome;
}

function updateDuelResultDerivedValues(result) {
  const criticalValues = result.criticalValues || [];
  const outcome = recalculateRollOutcome(result.rollLogs, criticalValues, false);
  result.total = outcome.total;
  result.injuryCount = outcome.injuryCount;
  return outcome;
}

function refreshWarPhaseState() {
  recalculatePlayerInjuries();

  if (currentPhaseId === 'warFinal') {
    phaseTargets[currentPhaseId] = phaseHistories[currentPhaseId].reduce((sum, record) => {
      return record.camp === '人狼側' ? sum + (record.total || 0) : sum;
    }, 0);
    updateTargetDisplay();
  }

  updateCurrentTotal();
  renderHistory();

  if (currentMode === 'war') {
    updateMaxPlayerDisplay();
  }

  updateLatestRollDisplay();
}

function renderHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  historyList.innerHTML = '';
  const currentHistory = phaseHistories[currentPhaseId];

  currentHistory.forEach((record, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    let borderColor = playerSettings[record.player]?.color || '#007cba';

    const playerDiv = document.createElement('div');
    playerDiv.className = 'history-player';
    
    let playerText = record.player;

    if (record.camp === '王国側') {
      playerDiv.classList.add('camp-a');
      borderColor = '#007cba';
      playerText = record.player;
    } else if (record.camp === '人狼側') {
      playerDiv.classList.add('camp-b');
      borderColor = '#e74c3c';
      playerText = record.player;
    }

    playerDiv.textContent = playerText;
    item.style.borderLeftColor = borderColor;

    const totalDiv = document.createElement('div');
    totalDiv.className = 'history-total';
    totalDiv.innerHTML = `合計: ${record.total}<br>負傷: ${record.injury}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn Orion_delete-circle';
    deleteBtn.textContent = '×';
    deleteBtn.setAttribute('aria-label', '履歴を削除');
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(index);
    });

    item.appendChild(playerDiv);
    item.appendChild(totalDiv);
    item.appendChild(deleteBtn);
    historyList.appendChild(item);

    item.addEventListener('click', () => {
      showDetailModal(record);
    });
  });
}

function deleteHistoryItem(index) {
  const confirmed = confirm('この履歴を削除しますか？');
  if (!confirmed) return;

  phaseHistories[currentPhaseId].splice(index, 1);
  updateCurrentTotal();
  renderHistory();
  if (currentMode === 'war') {
    updateMaxPlayerDisplay();
  }
  updateLatestRollDisplay();
}

function showDetailModal(record) {
  const modal = document.getElementById('detail-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalTotal = document.getElementById('modal-total');
  const modalInjury = document.getElementById('modal-injury');
  const flipButton = document.getElementById('detail-flip-enable-btn');

  modalTitle.textContent = `${record.player} の詳細結果`;
  modalTotal.textContent = `合計: ${record.total}`;
  modalInjury.textContent = `負傷: ${record.injury}`;
  
  renderLog(record.rollLogs, 'modal-log', false, record.criticalValues || [], record.flipUnlocked ? (result) => {
    applyDiceFlip(result);
    updateWarRecordDerivedValues(record);
    refreshWarPhaseState();
    showDetailModal(record);
  } : null);

  if (flipButton) {
    flipButton.disabled = !!record.flipUnlocked;
    flipButton.onclick = () => {
      if (record.flipUnlocked) return;
      record.flipUnlocked = true;
      flipButton.disabled = true;
      showDetailModal(record);
    };
  }

  showModal('detail-modal');
}

function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('show');
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('show');
}

function setupModal() {
  const modals = document.querySelectorAll('.modal, .roll-result-modal');
  modals.forEach(modal => {
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hideModal(modal.id);
      });
    }
  });

  // ロール結果モーダルのクリックイベント設定
  const rollResultModal = document.getElementById('roll-result-modal');
  if (rollResultModal) {
    rollResultModal.addEventListener('click', (e) => {
      if (e.target === rollResultModal) {
        rollResultModal.classList.remove('show');
      }
    });
  }

  const duelResultModal = document.getElementById('duel-result-modal');
  if (duelResultModal) {
    duelResultModal.addEventListener('click', (e) => {
      if (e.target === duelResultModal) {
        duelResultModal.classList.remove('show');
      }
    });
  }

  const testResultModal = document.getElementById('test-result-modal');
  if (testResultModal) {
    testResultModal.addEventListener('click', (e) => {
      if (e.target === testResultModal) {
        testResultModal.classList.remove('show');
      }
    });
  }
}

function setupPlayerSelect() {
  const selects = [
    document.getElementById('player-name'),
    document.getElementById('duel-player-name-1'),
    document.getElementById('duel-player-name-2'),
    document.getElementById('test-player-name')
  ];

  Players.forEach(player => {
    selects.forEach(select => {
      if (select) {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        select.appendChild(option);
      }
    });
  });
}

function setupPhaseSelect() {
  const select = document.getElementById('phase');
  if (!select) return;

  phases.forEach(phase => {
    const option = document.createElement('option');
    option.value = phase.id;
    option.textContent = phase.name;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    currentPhaseId = select.value;
    if (!phaseTargetLocked[currentPhaseId]) {
      showModal('target-setup-modal');
      document.getElementById('initial-target').value = 0;
    }
    updateTargetDisplay();
    updateCurrentTotal();
    renderHistory();
    if (currentMode === 'war') {
      updateMaxPlayerDisplay();
    }
    showCampOptionsIfNeeded();
    updateLatestRollDisplay();
  });

  const resetBtn = document.getElementById('reset-phase-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetCurrentPhase);
}

function updateTargetDisplay() {
  const targetLabel = document.getElementById('target-value');
  if (!targetLabel) return;
  
  targetLabel.textContent = phaseTargets[currentPhaseId];
}

function updateCurrentTotal() {
  const totalSpan = document.getElementById('current-total');
  if (!totalSpan) return;

  const currentHistory = phaseHistories[currentPhaseId];
  const total = currentHistory.reduce((sum, record) => {
    if (record.camp === '人狼側') return sum;
    return sum + record.total;
  }, 0);
  totalSpan.textContent = total;
}

function updateCurrentPlayerDisplay() {
  const playerSelect = document.getElementById('player-name');
  const playerDisplay = document.getElementById('current-player');
  if (playerSelect && playerDisplay) {
    playerDisplay.textContent = playerSelect.value || '未選択';
  }
}

function resetCurrentPhase() {
  const phaseName = phases.find(p => p.id === currentPhaseId)?.name || currentPhaseId;
  const confirmed = confirm(`「${phaseName}」の履歴と目標値をリセットします。よろしいですか？`);
  if (!confirmed) return;

  phaseHistories[currentPhaseId] = [];
  phaseTargets[currentPhaseId] = 0;
  phaseTargetLocked[currentPhaseId] = false;
  updateTargetDisplay();
  updateCurrentTotal();
  renderHistory();
  if (currentMode === 'war') {
    updateMaxPlayerDisplay();
  }
  updateLatestRollDisplay();
}

function getMaxPlayerForPhase(phaseId) {
  if (!warPhaseIds.includes(phaseId)) return null;
  const history = phaseHistories[phaseId];
  if (history.length === 0) return null;

  let maxRecord = history[0];
  for (let i = 1; i < history.length; i++) {
    if (history[i].total > maxRecord.total) {
      maxRecord = history[i];
    }
  }
  return maxRecord;
}

function updateMaxPlayerDisplay() {
  const maxPlayerInfo = document.getElementById('max-player-info');
  const maxPlayerArea = document.getElementById('max-player-area');
  
  if (!maxPlayerArea || !maxPlayerInfo) return;

  if (currentMode !== 'war' || !warPhaseIds.includes(currentPhaseId)) {
    maxPlayerArea.style.display = 'none';
    return;
  }
  
  maxPlayerArea.style.display = 'block';
  const maxRecord = getMaxPlayerForPhase(currentPhaseId);
  if (maxRecord) {
    maxPlayerInfo.textContent = `${maxRecord.player}（合計: ${maxRecord.total}）`;
  } else {
    maxPlayerInfo.textContent = '履歴がありません';
  }
}

function updateLatestRollDisplay() {
  const history = phaseHistories[currentPhaseId];
  const logElement = document.getElementById('log');
  const totalElement = document.getElementById('total');
  const injuryElement = document.getElementById('injury');
  const flipButton = document.getElementById('main-flip-enable-btn');

  if (!logElement || !totalElement || !injuryElement) return;

  if (history && history.length > 0) {
    const latest = history[0];
    renderLog(latest.rollLogs, 'log', false, latest.criticalValues || [], latest.flipUnlocked ? (result) => {
      applyDiceFlip(result);
      updateWarRecordDerivedValues(latest);
      refreshWarPhaseState();
    } : null);
    totalElement.textContent = `合計: ${latest.total}`;
    injuryElement.textContent = `負傷: ${latest.injury}`;

    if (flipButton) {
      flipButton.disabled = !!latest.flipUnlocked;
      flipButton.onclick = () => {
        if (latest.flipUnlocked) return;
        latest.flipUnlocked = true;
        flipButton.disabled = true;
        updateLatestRollDisplay();
      };
    }
  } else {
    logElement.innerHTML = '';
    totalElement.textContent = '合計: 0';
    injuryElement.textContent = '負傷: 0';
    if (flipButton) {
      flipButton.disabled = true;
    }
  }
}

function judgeResult() {
  const target = phaseTargets[currentPhaseId] || 0;
  const total = parseInt(document.getElementById('current-total').textContent, 10) || 0;
  const judgeModal = document.getElementById('judge-modal');
  const judgeTitle = document.getElementById('judge-title');
  const judgeMessage = document.getElementById('judge-message');

  // 最大出目プレイヤーの取得
  let maxPlayerName = '（該当者なし）';
  const maxRecord = getMaxPlayerForPhase(currentPhaseId);
  if (maxRecord) {
    maxPlayerName = maxRecord.player;
  }

  // タイトルの色付け用クラスをリセット
  judgeTitle.className = '';

  if (total >= target) {
    judgeTitle.textContent = '勝利！';
    judgeTitle.classList.add('win-title');
    judgeMessage.innerHTML = `目標値を達成しました！<br><br>本フェイズで英雄になったプレイヤーは<br><strong>${maxPlayerName}</strong> です。`;
  } else {
    judgeTitle.textContent = '敗北…';
    judgeTitle.classList.add('lose-title');
    judgeMessage.innerHTML = `目標値に届きませんでした。<br><br>本フェイズで英雄になったプレイヤーは<br><strong>${maxPlayerName}</strong> です。`;
  }
  
  showModal('judge-modal');
}

function showCampOptionsIfNeeded() {
  const campOptionsDiv = document.getElementById('camp-options');
  if (!campOptionsDiv) return;

  if (currentPhaseId === 'warFinal') {
    campOptionsDiv.style.display = 'flex';
  } else {
    campOptionsDiv.style.display = 'none';
  }
}

function setupCampOptions() {
  const campOptionsDiv = document.getElementById('camp-options');
  if (!campOptionsDiv) return;
  campOptionsDiv.innerHTML = '';

  const label = document.createElement('label');
  label.textContent = '陣営:';
  campOptionsDiv.appendChild(label);

  ['王国側', '人狼側'].forEach(camp => {
    const campLabel = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'camp';
    input.value = camp;
    if (camp === '王国側') input.checked = true;
    campLabel.appendChild(input);
    campLabel.appendChild(document.createTextNode(camp));
    campOptionsDiv.appendChild(campLabel);
  });
}

function setupModeSwitch() {
  const radios = document.querySelectorAll('input[name="app-mode"]');
  const warSection = document.getElementById('war-mode-section');
  const duelSection = document.getElementById('duel-mode-section');
  const testSection = document.getElementById('test-mode-section');
  const timerSection = document.getElementById('timer-mode-section');

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentMode = e.target.value;
      if (warSection) warSection.style.display = 'none';
      if (duelSection) duelSection.style.display = 'none';
      if (testSection) testSection.style.display = 'none';
      if (timerSection) timerSection.style.display = 'none';

      if (currentMode === 'war' && warSection) {
        warSection.style.display = 'block';
        updateMaxPlayerDisplay();
      } else if (currentMode === 'duel' && duelSection) {
        duelSection.style.display = 'block';
        updateMaxPlayerDisplay();
      } else if (currentMode === 'test' && testSection) {
        testSection.style.display = 'block';
        const maxArea = document.getElementById('max-player-area');
        if (maxArea) maxArea.style.display = 'none';
      } else if (currentMode === 'timer' && timerSection) {
        timerSection.style.display = 'block';
        const maxArea = document.getElementById('max-player-area');
        if (maxArea) maxArea.style.display = 'none';
        // ensure timer display is updated
        updateTimerDisplay();
        updatePhaseDisplay();
        updateTimerRunningUI();
      }
    });
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  el.textContent = formatTime(remainingSeconds);
}

function updatePhaseDisplay() {
  const el = document.getElementById('timer-phase-display');
  if (!el) return;
  el.textContent = timerPhase;
}

function updateTimerModalDisplay() {
  const phaseEl = document.getElementById('timer-modal-phase');
  const timeEl = document.getElementById('timer-modal-time');
  if (phaseEl) phaseEl.textContent = timerPhase;
  if (timeEl) timeEl.textContent = formatTime(remainingSeconds);
}

function updateTimerRunningUI() {
  const panel = document.querySelector('#timer-mode-section .timer-panel');
  const minInput = document.getElementById('timer-minutes');
  const secInput = document.getElementById('timer-seconds');
  const phaseRadios = document.querySelectorAll('input[name="timer-phase"]');

  if (panel) panel.classList.toggle('running', timerRunning);
  if (minInput) minInput.disabled = timerRunning;
  if (secInput) secInput.disabled = timerRunning;
  if (phaseRadios && phaseRadios.length > 0) {
    phaseRadios.forEach(r => {
      r.disabled = timerRunning;
    });
  }

  // running中はフェイズ選択を隠して操作不能にする
  togglePhaseChooser(!timerRunning);
}

function togglePhaseChooser(show) {
  const chooser = document.querySelector('.timer-phase-chooser');
  if (!chooser) return;
  chooser.style.display = show ? 'flex' : 'none';
}

function setTimerFromInputs() {
  const min = parseInt(document.getElementById('timer-minutes')?.value, 10) || 0;
  const sec = parseInt(document.getElementById('timer-seconds')?.value, 10) || 0;
  remainingSeconds = Math.max(0, min * 60 + sec);
  updateTimerDisplay();
}

function startTimer() {
  if (timerRunning) return;
  if (remainingSeconds <= 0) setTimerFromInputs();
  if (remainingSeconds <= 0) return;
  timerRunning = true;
  updateTimerRunningUI();
  // show timer modal
  updateTimerModalDisplay();
  showModal('timer-modal');
  timerInterval = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      pauseTimer();
      // タイムアップ時の簡易アラート
      try { alert('時間切れ！'); } catch (e) {}
    }
    updateTimerDisplay();
    updateTimerModalDisplay();
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateTimerRunningUI();
  updateTimerModalDisplay();
}

function resetTimer() {
  pauseTimer();
  setTimerFromInputs();
  updateTimerRunningUI();
}

function setupTimer() {
  const startBtn = document.getElementById('timer-start-btn');
  const resetBtn = document.getElementById('timer-reset-btn');
  const minInput = document.getElementById('timer-minutes');
  const secInput = document.getElementById('timer-seconds');
  const toggleBtn = document.getElementById('timer-toggle-btn');
  const phaseRadios = document.querySelectorAll('input[name="timer-phase"]');

  if (minInput && secInput) {
    minInput.addEventListener('change', () => { setTimerFromInputs(); });
    secInput.addEventListener('change', () => { setTimerFromInputs(); });
  }
  if (toggleBtn) toggleBtn.addEventListener('click', () => { startPauseToggle(); });
  if (resetBtn) resetBtn.addEventListener('click', () => { resetTimer(); updateTimerModalDisplay(); updateToggleButtons(); });

  if (phaseRadios && phaseRadios.length > 0) {
    phaseRadios.forEach(r => r.addEventListener('change', () => {
      if (r.checked) timerPhase = r.value;
      updatePhaseDisplay();
      updateTimerModalDisplay();
    }));
    // initialize phase from selected radio
    const init = Array.from(phaseRadios).find(r => r.checked);
    if (init) timerPhase = init.value;
    updatePhaseDisplay();
    updateTimerModalDisplay();
  }
  // initialize display
  setTimerFromInputs();
  updateTimerRunningUI();

  // modal buttons wiring
  const modalToggle = document.getElementById('timer-modal-toggle');
  const modalReset = document.getElementById('timer-modal-reset');
  const modalClose = document.getElementById('timer-modal-close');

  if (modalToggle) modalToggle.addEventListener('click', () => { startPauseToggle(); });
  if (modalReset) modalReset.addEventListener('click', () => { resetTimer(); updateTimerModalDisplay(); updateToggleButtons(); });
  if (modalClose) modalClose.addEventListener('click', () => { hideModal('timer-modal'); });
}

function startPauseToggle() {
  if (timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
  updateToggleButtons();
}

function updateToggleButtons() {
  const mainBtn = document.getElementById('timer-toggle-btn');
  const modalBtn = document.getElementById('timer-modal-toggle');
  const label = timerRunning ? '一時停止' : '開始';
  if (mainBtn) mainBtn.textContent = label;
  if (modalBtn) modalBtn.textContent = label;
}

document.addEventListener('DOMContentLoaded', () => {
  setupPlayerSelect();
  setupPhaseSelect();
  setupModal();
  setupCampOptions();
  setupModeSwitch();
  setupTimer();
  updateTargetDisplay();
  updateMaxPlayerDisplay();
  showCampOptionsIfNeeded();
  updateCurrentPlayerDisplay();

  const diceForm = document.getElementById('dice-form');
  if (diceForm) {
    diceForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const playerName = document.getElementById('player-name').value;
      const diceCount = parseInt(document.getElementById('dice-count').value, 10);
      const criticalCheckboxes = document.querySelectorAll('input[name="critical"]:checked');
      const criticalValues = Array.from(criticalCheckboxes).map(cb => parseInt(cb.value, 10));

      if (criticalValues.length === 0) {
        alert('クリティカルになる出目を1つ以上選択してください。');
        return;
      }
      if (criticalValues.length >= 6) {
        alert('クリティカルになる出目は6個すべてにすることはできません。');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      const { total, rollLogs, injuryCount } = rollDice(diceCount, criticalValues);

      if (playerSettings[playerName]) {
        playerSettings[playerName].injury += injuryCount;
      }

      const record = {
        player: playerName,
        total,
        injury: injuryCount,
        rollLogs: JSON.parse(JSON.stringify(rollLogs)),
        criticalValues: [...criticalValues],
        flipUnlocked: false,
        phase: currentPhaseId,
        camp: null,
        timestamp: Date.now()
      };

      let camp = null;
      if (currentPhaseId === 'warFinal') {
        const campRadio = document.querySelector('input[name="camp"]:checked');
        if (campRadio) {
          camp = campRadio.value;
          playerSettings[playerName].camp = camp;
          if (camp === '人狼側') {
            phaseTargets[currentPhaseId] += total;
            updateTargetDisplay();
          }
        }
      }

      record.camp = camp;

      const currentHistory = phaseHistories[currentPhaseId];
      currentHistory.unshift(record);

      updateWarRecordDerivedValues(record);
      refreshWarPhaseState();

      // ロール結果ポップアップを表示
      const rerenderWarPopup = () => {
        showRollResultPopup(playerName, record.rollLogs, record.total, record.injury, record.criticalValues, (result) => {
          applyDiceFlip(result);
          updateWarRecordDerivedValues(record);
          refreshWarPhaseState();
          rerenderWarPopup();
        }, record, rerenderWarPopup);
      };

      rerenderWarPopup();
    });
  }

  const duelForm = document.getElementById('duel-form');
  if (duelForm) {
    duelForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const name1 = document.getElementById('duel-player-name-1').value;
      const count1 = parseInt(document.getElementById('duel-dice-count-1').value, 10);
      const critCheckboxes1 = document.querySelectorAll('input[name="critical-1"]:checked');
      const critValues1 = Array.from(critCheckboxes1).map(cb => parseInt(cb.value, 10));

      const name2 = document.getElementById('duel-player-name-2').value;
      const count2 = parseInt(document.getElementById('duel-dice-count-2').value, 10);
      const critCheckboxes2 = document.querySelectorAll('input[name="critical-2"]:checked');
      const critValues2 = Array.from(critCheckboxes2).map(cb => parseInt(cb.value, 10));

      if (critValues1.length === 0 || critValues2.length === 0) {
        alert('両プレイヤーともクリティカルになる出目を1つ以上選択してください。');
        return;
      }
      if (critValues1.length >= 6 || critValues2.length >= 6) {
        alert('クリティカルになる出目は6個すべてにすることはできません。');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const result1 = rollDice(count1, critValues1);
      const result2 = rollDice(count2, critValues2);
      result1.criticalValues = [...critValues1];
      result2.criticalValues = [...critValues2];
      result1.flipUnlocked = false;
      result2.flipUnlocked = false;

      const updateDuelWinnerMessage = () => {
        const resultMsg = document.getElementById('duel-result-message');
        if (result1.total > result2.total) {
          resultMsg.textContent = `${name1} の勝利！`;
          resultMsg.style.color = '#e74c3c';
        } else if (result2.total > result1.total) {
          resultMsg.textContent = `${name2} の勝利！`;
          resultMsg.style.color = '#007cba';
        } else {
          resultMsg.textContent = '引き分け！';
          resultMsg.style.color = '#333';
        }
      };

      const rerenderDuelViews = () => {
        renderLog(result1.rollLogs, 'duel-log-1', false, result1.criticalValues, (result) => {
          applyDiceFlip(result);
          updateDuelResultDerivedValues(result1);
          updateDuelResultDerivedValues(result2);
          rerenderDuelViews();
        });
        document.getElementById('duel-total-1').textContent = `合計: ${result1.total}`;
        document.getElementById('duel-injury-1').textContent = `負傷: ${result1.injuryCount}`;

        renderLog(result2.rollLogs, 'duel-log-2', false, result2.criticalValues, (result) => {
          applyDiceFlip(result);
          updateDuelResultDerivedValues(result1);
          updateDuelResultDerivedValues(result2);
          rerenderDuelViews();
        });
        document.getElementById('duel-total-2').textContent = `合計: ${result2.total}`;
        document.getElementById('duel-injury-2').textContent = `負傷: ${result2.injuryCount}`;

        updateDuelWinnerMessage();
        showDuelRollResultPopup(name1, result1, name2, result2, rerenderDuelViews);
      };

      rerenderDuelViews();
    });
  }

  const testForm = document.getElementById('test-form');
  if (testForm) {
    testForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const playerName = document.getElementById('test-player-name').value;
      
      const count = parseInt(document.getElementById('test-dice-count').value, 10);
      const target = parseInt(document.getElementById('test-target').value, 10);
      const modifier = parseInt(document.getElementById('test-modifier').value, 10);

      if (isNaN(count) || count < 1) {
        alert('ダイスの個数を正しく入力してください。');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      let diceSum = 0;
      const rollLogs = [[]];
      
      for (let i = 0; i < count; i++) {
        const val = rollD6();
        diceSum += val;
        rollLogs[0].push({ value: val, isCrit: false });
      }

      const finalTarget = isNaN(target) ? 0 : target;

      const testSession = { flipUnlocked: false };

      const renderTestState = () => {
        const currentTotal = recalculateRollOutcome(rollLogs, [], true).total;
        const adjustedTotal = currentTotal + (isNaN(modifier) ? 0 : modifier);
        const success = adjustedTotal >= finalTarget;

        renderLog(rollLogs, 'test-log', true, [], testSession.flipUnlocked ? (result) => {
          applyDiceFlip(result);
          rerenderTestViews();
        } : null);

        const totalDisplay = document.getElementById('test-total');
        if (modifier !== 0) {
          const sign = modifier > 0 ? '+' : '';
          totalDisplay.textContent = `出目合計: ${currentTotal} ${sign} ${modifier} = 最終達成値: ${adjustedTotal}`;
        } else {
          totalDisplay.textContent = `達成値: ${adjustedTotal}`;
        }

        const resultMsg = document.getElementById('test-result-message');
        if (success) {
          resultMsg.textContent = '成功！';
          resultMsg.style.color = '#27ae60';
        } else {
          resultMsg.textContent = '失敗…';
          resultMsg.style.color = '#e74c3c';
        }
      };

      const rerenderTestViews = () => {
        renderTestState();
        const currentTotal = recalculateRollOutcome(rollLogs, [], true).total;
        const adjustedTotal = currentTotal + (isNaN(modifier) ? 0 : modifier);
        const success = adjustedTotal >= finalTarget;
        showTestRollResultPopup(playerName, rollLogs, currentTotal, finalTarget, modifier, success, testSession.flipUnlocked ? (result) => {
          applyDiceFlip(result);
          rerenderTestViews();
        } : null, testSession, rerenderTestViews);
      };

      rerenderTestViews();
    });
  }

  const targetSetupForm = document.getElementById('target-setup-form');
  if (targetSetupForm) {
    targetSetupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const value = parseInt(document.getElementById('initial-target').value, 10) || 0;
      phaseTargets[currentPhaseId] = value;
      phaseTargetLocked[currentPhaseId] = true;
      updateTargetDisplay();
      hideModal('target-setup-modal');
    });
  }

  const judgeButton = document.getElementById('judge-button');
  if (judgeButton) {
    judgeButton.addEventListener('click', judgeResult);
  }

  const playerNameInput = document.getElementById('player-name');
  if (playerNameInput) {
    playerNameInput.addEventListener('change', updateCurrentPlayerDisplay);
  }
});