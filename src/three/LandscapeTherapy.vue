<template>
  <div class="therapy-page">
    <div class="therapy-grid">
      <!-- 基础数值 -->
      <section class="panel base-panel">
        <h3 class="panel-title"><span class="dot"></span>基础数值</h3>

        <label class="field">
          <span class="field-label">基础生命值</span>
          <input v-model.number="base.hpBase" class="field-input" type="number" min="0" />
        </label>

        <label class="field">
          <span class="field-label">基础速度</span>
          <input v-model.number="base.speedBase" class="field-input" type="number" min="0" />
        </label>

        <label class="field">
          <span class="field-label">
            风堇生命值
            <em class="tag">自动</em>
          </span>
          <input class="field-input is-auto" type="number" :value="fmt(hpTotal)" readonly />
        </label>

        <label class="field">
          <span class="field-label">
            速度
            <em class="tag">自动</em>
          </span>
          <input class="field-input is-auto" type="number" :value="fmt(speedTotal)" readonly />
        </label>

        <label class="field">
          <span class="field-label">
            小伊卡生命值
            <em class="tag">自动</em>
          </span>
          <input class="field-input is-auto" type="number" :value="fmt(icaHp)" readonly />
        </label>

        <label class="field">
          <span class="field-label">场上单位数量</span>
          <input v-model.number="base.units" class="field-input" type="number" min="1" step="1" />
        </label>

        <label class="field">
          <span class="field-label">场上单位总血量</span>
          <input v-model.number="base.totalHp" class="field-input" type="number" min="0" />
        </label>

        <p class="field-hint">
          风堇生命值与速度由底部计算明细自动得出；总血量默认为示例值 30000，请按实际情况填写。
        </p>

        <button class="reset-btn" type="button" @click="resetBase">恢复默认值</button>
      </section>

      <div class="calc-area">
        <div class="calc-grid">
          <!-- 扣血量 -->
          <section class="panel drain-panel">
            <h3 class="panel-title"><span class="dot"></span>扣血量</h3>

            <label class="field">
              <span class="field-label">小伊卡自扣血</span>
              <input class="field-input is-auto" type="number" :value="fmt(icaSelfDrain)" readonly />
            </label>

            <label class="field">
              <span class="field-label">专武扣除血量</span>
              <input class="field-input is-auto" type="number" :value="fmt(weaponDrain)" readonly />
            </label>

            <label class="field is-total">
              <span class="field-label">扣血合计</span>
              <input class="field-input is-auto" type="number" :value="fmt(drainTotal)" readonly />
            </label>
          </section>

          <!-- 治疗量 -->
          <section class="panel heal-panel">
            <h3 class="panel-title"><span class="dot"></span>治疗量</h3>

            <label class="field">
              <span class="field-label">战技治疗量</span>
              <input class="field-input is-auto" type="number" :value="fmt(skillHeal)" readonly />
            </label>

            <label class="field">
              <span class="field-label">小伊卡治疗量</span>
              <input class="field-input is-auto" type="number" :value="fmt(icaHeal)" readonly />
            </label>

            <label class="field">
              <span class="field-label">一魂攻击回血</span>
              <input class="field-input is-auto" type="number" :value="fmt(eidolonHeal)" readonly />
            </label>

            <label class="field is-total">
              <span class="field-label">基础治疗合计</span>
              <input class="field-input is-auto" type="number" :value="fmt(baseHealTotal)" readonly />
            </label>

            <label class="field">
              <span class="field-label">治疗量加成</span>
              <span class="value-wrap">
                <input class="field-input is-auto" type="number" :value="pct(healBonusTotal)" readonly />
                <em class="unit">%</em>
              </span>
            </label>

            <label class="field is-total">
              <span class="field-label">总治疗量</span>
              <input class="field-input is-auto" type="number" :value="fmt(totalHeal)" readonly />
            </label>
          </section>

          <!-- 新蕊结果 -->
          <section class="panel result-panel">
            <div class="result-head">
              <span class="result-label">新蕊充能</span>
              <span class="result-cap">上限 {{ NEWBUD_CAP }}</span>
            </div>

            <div class="result-readout">
              <input class="result-input is-auto" type="number" :value="fmt(newbud)" readonly />
              <span class="result-percent">{{ percentText }}</span>
            </div>

            <div class="progress">
              <div class="progress-fill" :style="{ width: `${percent}%` }"></div>
            </div>

            <p class="result-hint">{{ resultHint }}</p>
          </section>
        </div>
      </div>
    </div>

    <!-- 计算明细 -->
    <section class="panel detail-panel">
      <h3 class="panel-title"><span class="dot"></span>计算明细</h3>

      <div class="detail-grid">
        <!-- 生命值构成 -->
        <div class="detail-block">
          <h4 class="detail-title">生命值构成</h4>

          <div class="detail-row">
            <div class="detail-text"><span class="detail-name">基础生命值</span></div>
            <input class="detail-input" type="number" :value="fmt2(hpBase)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">生命加成 1</span>
              <span class="detail-expr">{{ `${fmt(hpBase)} × 121.333%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(hpBonus1)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">生命加成 2</span>
              <span class="detail-expr">{{ `${fmt(hpBase)} × 30%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(hpBonus2)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">固定生命加成</span>
              <span class="detail-expr">+600</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(hpFlat)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">生命加成 3</span>
              <span class="detail-expr">{{ `${fmt(hpBase)} × 20%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(hpBonus3)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">生命加成 4</span>
              <span class="detail-expr">{{ `${fmt(hpBase)} × 50%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(hpBonus4)" readonly />
          </div>

          <div class="detail-row is-total">
            <div class="detail-text">
              <span class="detail-name">风堇生命值</span>
              <span class="detail-expr">六项逐项相加</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(hpTotal)" readonly />
          </div>
        </div>

        <!-- 速度构成 -->
        <div class="detail-block">
          <h4 class="detail-title">速度构成</h4>

          <div class="detail-row">
            <div class="detail-text"><span class="detail-name">基础速度</span></div>
            <input class="detail-input" type="number" :value="fmt2(speedBase)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">速度加成 1</span>
              <span class="detail-expr">{{ `${fmt(speedBase)} × 18%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(speedBonus1)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">速度加成 2</span>
              <span class="detail-expr">{{ `${fmt(speedBase)} × 30%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(speedBonus2)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">速度加成 3</span>
              <span class="detail-expr">{{ `${fmt(speedBase)} × 20%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(speedBonus3)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">速度加成 4</span>
              <span class="detail-expr">{{ `${fmt(speedBase)} × 12%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(speedBonus4)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">速度加成 5</span>
              <span class="detail-expr">{{ `${fmt(speedBase)} × 8%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(speedBonus5)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">遗器速度</span>
              <span class="detail-expr">+109</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(SPEED_FLAT)" readonly />
          </div>

          <div class="detail-row is-total">
            <div class="detail-text">
              <span class="detail-name">速度</span>
              <span class="detail-expr">七项逐项相加</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(speedTotal)" readonly />
          </div>
        </div>

        <!-- 治疗量加成 -->
        <div class="detail-block">
          <h4 class="detail-title">治疗量加成</h4>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">固定治疗加成 1</span>
              <span class="detail-expr">常量 0.345</span>
            </div>
            <span class="value-wrap">
              <input class="detail-input" type="number" :value="pct(healBonusFixed1)" readonly />
              <em class="unit">%</em>
            </span>
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">速度转化加成</span>
              <span class="detail-expr">{{ `(${fmt(speedTotal)} - 200) × 1%` }}</span>
            </div>
            <span class="value-wrap">
              <input class="detail-input" type="number" :value="pct(healBonusSpeed)" readonly />
              <em class="unit">%</em>
            </span>
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">固定治疗加成 2</span>
              <span class="detail-expr">常量 0.2</span>
            </div>
            <span class="value-wrap">
              <input class="detail-input" type="number" :value="pct(healBonusFixed2)" readonly />
              <em class="unit">%</em>
            </span>
          </div>

          <div class="detail-row is-total">
            <div class="detail-text">
              <span class="detail-name">治疗量加成</span>
              <span class="detail-expr">三项逐项相加</span>
            </div>
            <span class="value-wrap">
              <input class="detail-input" type="number" :value="pct(healBonusTotal)" readonly />
              <em class="unit">%</em>
            </span>
          </div>
        </div>

        <!-- 治疗量构成 -->
        <div class="detail-block">
          <h4 class="detail-title">治疗量构成</h4>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">战技治疗量（基础）</span>
              <span class="detail-expr">
                {{ `(${unitCount} - 1) × (${fmt(hpTotal)} × 8% + 160) + (${fmt(hpTotal)} × 10% + 200)` }}
              </span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(skillHeal)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">小伊卡治疗量（基础）</span>
              <span class="detail-expr">{{ `${unitCount} × (${fmt(hpTotal)} × 4% + 40)` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(icaHeal)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">一魂攻击回血（基础）</span>
              <span class="detail-expr">{{ `${fmt(hpTotal)} × 8%` }}</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(eidolonHeal)" readonly />
          </div>

          <div class="detail-row is-total">
            <div class="detail-text">
              <span class="detail-name">基础治疗合计</span>
              <span class="detail-expr">三项逐项相加</span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(baseHealTotal)" readonly />
          </div>

          <div class="detail-row">
            <div class="detail-text">
              <span class="detail-name">治疗量加成</span>
              <span class="detail-expr">乘数 1 + {{ pct(healBonusTotal) }}%</span>
            </div>
            <span class="value-wrap">
              <input class="detail-input" type="number" :value="pct(healBonusTotal)" readonly />
              <em class="unit">%</em>
            </span>
          </div>

          <div class="detail-row is-total">
            <div class="detail-text">
              <span class="detail-name">总治疗量</span>
              <span class="detail-expr">
                {{ `${fmt(baseHealTotal)} × (1 + ${pct(healBonusTotal)}%)` }}
              </span>
            </div>
            <input class="detail-input" type="number" :value="fmt2(totalHeal)" readonly />
          </div>
        </div>

        <!-- 新蕊构成 -->
        <div class="detail-block is-wide">
          <h4 class="detail-title">新蕊构成</h4>

          <div class="detail-columns">
            <div class="detail-row">
              <div class="detail-text">
                <span class="detail-name">总治疗量</span>
                <span class="detail-expr">基础治疗合计 × 加成</span>
              </div>
              <input class="detail-input" type="number" :value="fmt2(totalHeal)" readonly />
            </div>

            <div class="detail-row">
              <div class="detail-text">
                <span class="detail-name">扣血合计</span>
                <span class="detail-expr">小伊卡自扣血 + 专武扣除</span>
              </div>
              <input class="detail-input" type="number" :value="fmt2(drainTotal)" readonly />
            </div>

            <div class="detail-row is-total">
              <div class="detail-text">
                <span class="detail-name">新蕊</span>
                <span class="detail-expr">总量上限 {{ NEWBUD_CAP }}，当前 {{ percentText }}</span>
              </div>
              <input class="detail-input" type="number" :value="fmt2(newbud)" readonly />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';

const NEWBUD_CAP = 34000;

// 加成常量（只读展示，不合并同类项）
const HP_BONUS_1 = 1.21333;
const HP_BONUS_2 = 0.3;
const HP_FLAT = 600;
const HP_BONUS_3 = 0.2;
const HP_BONUS_4 = 0.5;

const SPEED_BONUS_1 = 0.18;
const SPEED_BONUS_2 = 0.3;
const SPEED_BONUS_3 = 0.2;
const SPEED_BONUS_4 = 0.12;
const SPEED_BONUS_5 = 0.08;
const SPEED_FLAT = 109;

const HEAL_BONUS_FIXED_1 = 0.345;
const HEAL_BONUS_FIXED_2 = 0.2;

const DEFAULTS = {
  hpBase: 2250,
  speedBase: 110,
  units: 6,
  totalHp: 30000,
};

const base = reactive({ ...DEFAULTS });

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (value) => {
  const n = num(value);
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const fmt2 = (value) => {
  const n = num(value);
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
};

const pct = (value) => fmt(num(value) * 100);

// 生命值：基础值 + 五项加成，逐项独立
const hpBase = computed(() => Math.max(0, num(base.hpBase)));
const hpBonus1 = computed(() => hpBase.value * HP_BONUS_1);
const hpBonus2 = computed(() => hpBase.value * HP_BONUS_2);
const hpFlat = HP_FLAT;
const hpBonus3 = computed(() => hpBase.value * HP_BONUS_3);
const hpBonus4 = computed(() => hpBase.value * HP_BONUS_4);
const hpTotal = computed(
  () =>
    hpBase.value +
    hpBonus1.value +
    hpBonus2.value +
    hpFlat +
    hpBonus3.value +
    hpBonus4.value
);

// 速度：基础值 + 五项加成，逐项独立
const speedBase = computed(() => Math.max(0, num(base.speedBase)));
const speedBonus1 = computed(() => speedBase.value * SPEED_BONUS_1);
const speedBonus2 = computed(() => speedBase.value * SPEED_BONUS_2);
const speedBonus3 = computed(() => speedBase.value * SPEED_BONUS_3);
const speedBonus4 = computed(() => speedBase.value * SPEED_BONUS_4);
const speedBonus5 = computed(() => speedBase.value * SPEED_BONUS_5);
const speedTotal = computed(
  () =>
    speedBase.value +
    speedBonus1.value +
    speedBonus2.value +
    speedBonus3.value +
    speedBonus4.value +
    speedBonus5.value +
    SPEED_FLAT
);

const unitCount = computed(() => Math.max(1, Math.floor(num(base.units))));
const totalHp = computed(() => Math.max(0, num(base.totalHp)));

// 小伊卡生命值
const icaHp = computed(() => hpTotal.value * 0.5);

// 扣血量
const icaSelfDrain = computed(() => icaHp.value * 0.04);
const weaponDrain = computed(() => totalHp.value * 0.01);
const drainTotal = computed(() => icaSelfDrain.value + weaponDrain.value);

// 治疗量加成：三项独立
const healBonusFixed1 = HEAL_BONUS_FIXED_1;
const healBonusSpeed = computed(() => (speedTotal.value - 200) * 0.01);
const healBonusFixed2 = HEAL_BONUS_FIXED_2;
const healBonusTotal = computed(
  () => healBonusFixed1 + healBonusSpeed.value + healBonusFixed2
);

// 基础治疗量（未乘加成）
const skillHeal = computed(
  () => (unitCount.value - 1) * (hpTotal.value * 0.08 + 160) + (hpTotal.value * 0.1 + 200)
);
const icaHeal = computed(() => unitCount.value * (hpTotal.value * 0.04 + 40));
const eidolonHeal = computed(() => hpTotal.value * 0.08);
const baseHealTotal = computed(() => skillHeal.value + icaHeal.value + eidolonHeal.value);

// 总治疗量 = 基础治疗量 × (1 + 治疗量加成)
const totalHeal = computed(() => baseHealTotal.value * (1 + healBonusTotal.value));

// 新蕊 = 总治疗量 + 扣血合计，上限 34000
const rawNewbud = computed(() => totalHeal.value + drainTotal.value);
const newbud = computed(() => Math.min(rawNewbud.value, NEWBUD_CAP));
const overflow = computed(() => Math.max(0, rawNewbud.value - NEWBUD_CAP));
const remaining = computed(() => Math.max(0, NEWBUD_CAP - newbud.value));
const percent = computed(() => (newbud.value / NEWBUD_CAP) * 100);
const percentText = computed(() => `${percent.value.toFixed(1)}%`);

const resultHint = computed(() => {
  const breakdown = `总治疗量 ${fmt(totalHeal.value)} + 扣血合计 ${fmt(drainTotal.value)}`;
  return overflow.value > 0
    ? `${breakdown}；已超出上限 ${fmt(overflow.value)} 点`
    : `${breakdown}；还需 ${fmt(remaining.value)} 点充满`;
});

const resetBase = () => {
  Object.assign(base, DEFAULTS);
};
</script>

<style scoped>
.therapy-page {
  height: 100%;
  padding: 20px 24px 28px;
  overflow-y: auto;
  box-sizing: border-box;
  color: var(--text-1);
}

.therapy-grid {
  display: grid;
  grid-template-columns: minmax(0, 330px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.calc-area {
  min-width: 0;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--stroke-soft);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.022));
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--panel-accent, var(--accent));
}

.drain-panel {
  --panel-accent: #ff8080;
}

.heal-panel {
  --panel-accent: #63dba5;
}

.result-panel {
  --panel-accent: var(--accent);
  grid-column: 1 / -1;
  border-color: rgba(110, 139, 255, 0.28);
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
}

.field + .field {
  border-top: 1px dashed rgba(255, 255, 255, 0.055);
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}

.value-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.unit {
  font-size: 11px;
  font-style: normal;
  color: var(--text-3);
}

.field-input {
  flex: 0 0 auto;
  width: 132px;
  height: 34px;
  padding: 0 10px;
  border-radius: 9px;
  border: 1px solid var(--stroke-soft);
  background: rgba(6, 10, 26, 0.4);
  color: var(--text-1);
  font: 500 13px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: right;
  outline: none;
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}

.field-input::-webkit-outer-spin-button,
.field-input::-webkit-inner-spin-button,
.detail-input::-webkit-outer-spin-button,
.detail-input::-webkit-inner-spin-button,
.result-input::-webkit-outer-spin-button,
.result-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.field-input:focus {
  border-color: var(--accent);
  background: rgba(6, 10, 26, 0.62);
}

.field-input.is-auto {
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.03);
  cursor: default;
}

.field-input.is-auto:focus {
  border-color: var(--stroke-soft);
}

.field.is-total .field-label {
  font-weight: 600;
  color: var(--text-1);
}

.field.is-total .field-input {
  border-color: rgba(255, 255, 255, 0.16);
}

.tag {
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--stroke-soft);
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0;
  color: var(--text-3);
}

.field-hint {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
}

.reset-btn {
  width: 100%;
  height: 34px;
  margin-top: 14px;
  border-radius: 9px;
  border: 1px solid var(--stroke-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s var(--ease), color 0.2s var(--ease);
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-1);
}

.result-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.result-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.result-cap {
  font-size: 11px;
  color: var(--text-3);
}

.result-readout {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
}

.result-input {
  width: 200px;
  height: 52px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(110, 139, 255, 0.35);
  background: rgba(6, 10, 26, 0.5);
  color: #fff;
  font: 600 24px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: right;
  outline: none;
}

.result-percent {
  font: 600 15px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--accent);
}

.progress {
  height: 8px;
  margin-top: 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #6e8bff, #63dba5);
  transition: width 0.25s var(--ease);
}

.result-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
}

.detail-panel {
  margin-top: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
}

.detail-block {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.055);
  background: rgba(255, 255, 255, 0.025);
}

.detail-block.is-wide {
  grid-column: 1 / -1;
}

.detail-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.detail-row + .detail-row {
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
}

.detail-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-name {
  font-size: 12px;
  color: var(--text-2);
}

.detail-expr {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
  word-break: break-word;
}

.detail-row.is-total .detail-name {
  font-weight: 600;
  color: var(--text-1);
}

.detail-row.is-total .detail-input {
  border-color: rgba(255, 255, 255, 0.16);
}

.detail-input {
  flex: 0 0 auto;
  width: 96px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid var(--stroke-soft);
  background: rgba(6, 10, 26, 0.36);
  color: var(--text-2);
  font: 500 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: right;
  outline: none;
}

.detail-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 18px;
}

@media (max-width: 1180px) {
  .therapy-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .calc-grid {
    grid-template-columns: 1fr;
  }

  .result-input {
    flex: 1;
    width: auto;
  }
}
</style>
