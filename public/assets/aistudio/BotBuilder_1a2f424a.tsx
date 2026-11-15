import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Square, 
  Save, 
  FolderOpen, 
  Zap, 
  HelpCircle, 
  Settings, 
  ChevronRight,
  ChevronUp,
  Search,
  Bell,
  Clock,
  MessageSquare,
  LayoutDashboard,
  Bot,
  LineChart,
  PieChart,
  Wrench,
  Layout,
  RotateCcw,
  Undo,
  Redo,
  Plus,
  Minus,
  Quote,
  RotateCw,
  X,
  Package,
  Download,
  Eye,
  TrendingUp,
  TrendingDown,
  Loader2,
  Activity,
  Monitor,
  Triangle,
  LayoutGrid,
  Layers,
  Trash2,
  RefreshCw,
  Compass,
  Target
} from 'lucide-react';
import { cn, getActiveToken, getActiveAccountType, getActiveAccountId } from './lib/utils';
import { 
  computeDiffersSignal, 
  computeOverUnderSignal, 
  computeAccumulatorSignal, 
  computeMatchSignal,
  getAllMarketDifferSignals,
  DifferSignalData
} from './lib/analysisSignalBridge';
import { computeAccuNoiseSignal } from './lib/autobotSignals';

const OTIVO_LOGO_WHITE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMjAgNUwzNSAxMi41VjI3LjVMMjAgMzVMNSAyNy41VjEyLjVMMjAgNVoiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0yMCAxMlYyOCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNMTQgMThIMjYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTE0IDIySDI2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4=";
const PLUS_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGxpbmUgeDE9IjEyIiB5MT0iNSIgeDI9IjEyIiB5Mj0iMTkiPjwvbGluZT48bGluZSB4MT0iNSIgeTE9IjEyIiB4Mj0iMTkiIHkyPSIxMiI+PC9saW5lPjwvc3ZnPg==";
const MINUS_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGxpbmUgeDE9IjUiIHkxPSIxMiIgeDI9IjE5IiB5Mj0iMTIiPjwvbGluZT48L3N2Zz4=";
const ONLY_UPS_ICON = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMTciIHdpZHRoPSIzIiBoZWlnaHQ9IjMiIGZpbGw9IiM5NGI5YmUiIC8+PHJlY3QgeD0iNyIgeT0iMTQiIHdpZHRoPSIzIiBoZWlnaHQ9IjYiIGZpbGw9IiM5NGI5YmUiIC8+PHJlY3QgeD0iMTIiIHk9IjEwIiB3aWR0aD0iMyIgaGVpZ2h0PSIxMCIgZmlsbD0iIzk0YjliZSIgLz48cmVjdCB4PSIxNyIgeT0iNCIgd2lkdGg9IjMiIGhlaWdodD0iMTYiIGZpbGw9IiM5NGI5YmUiIC8+PHBhdGggZD0iTTUsMTMgTDEzLDUgTDEwLDUgTDEwLDMgTDE2LDMgTDE2LDkgTDE0LDkgTDE0LDYgTDYsMTQgWiIgZmlsbD0iI2ZmNGQ0ZCIgLz48L3N2Zz4=";
const ONLY_DOWNS_ICON = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iNCIgd2lkdGg9IjMiIGhlaWdodD0iMyIgZmlsbD0iIzk0YjliZSIgLz48cmVjdCB4PSI3IiB5PSI0IiB3aWR0aD0iMyIgaGVpZ2h0PSI3IiBmaWxsPSIjOTRiOWJlIiAvPjxyZWN0IHg9IjEyIiB5PSI0IiB3aWR0aD0iMyIgaGVpZ2h0PSIxMSIgZmlsbD0iIzk0YjliZSIgLz48cmVjdCB4PSIxNyIgeT0iNCIgd2lkdGg9IjMiIGhlaWdodD0iMTciIGZpbGw9IiM5NGI5YmUiIC8+PHBhdGggZD0iTTUsMTEgTDEzLDE5IEwxMCwxOSBMMTAsMjEgTDE2LDIxIEwxNiwxNSBMMTQsMTUgTDE0LDE4IEw2LDEwIFoiIGZpbGw9IiNmZjRkNGQiIC8+PC9zdmc+";

const TRADE_PARAMS_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGxpbmUgeDE9IjgiIHkxPSI2IiB4Mj0iMjEiIHkyPSI2Ij48L2xpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMiIgeDI9IjIxIiB5Mj0iMTIiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE4IiB4Mj0iMjEiIHkyPSIxOCI+PC9saW5lPjxsaW5lIHgxPSIzIiB5MT0iNiIgeDI9IjMuMDEiIHkyPSI2Ij48L2xpbmU+PGxpbmUgeDE9IjMiIHkxPSIxMiIgeDI9IjMuMDEiIHkyPSIxMiI+PC9saW5lPjxsaW5lIHgxPSIzIiB5MT0iMTgiIHgyPSIzLjAxIiB5Mj0iMTgiPjwvbGluZT48L3N2Zz4=";
const PURCHASE_COND_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTUgMTEgNC03Ij48L3BhdGg+PHBhdGggZD0ibTE5IDExLTQtNyI+PC9wYXRoPjxwYXRoIGQ9Ik0yIDExaDIwIj48L3BhdGggPjxwYXRoIGQ9Im0zLjUgMTEgMS42IDcuNGEyIDIgMCAwIDAgMiAxLjZoOS44YTIgMiAwIDAgMCAyLTEuNmwxLjctNy40Ij48L3BhdGggPjxwYXRoIGQ9Im05IDExIDEgOSI+PC9wYXRoPjxwYXRoIGQ9Im0xNSAxMS0xIDkiPjwvcGF0aD48L3N2Zz4=";
const SELL_COND_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjEyIiB4PSIyIiB5PSI2IiByeD0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjIiPjwvY2lyY2xlPjxwYXRoIGQ9Ik02IDEyaC4wMU0xOCAxMmguMDEiPjwvcGF0aD48L3N2Zz4=";
const RESTART_COND_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTQgMTVzMS0xIDQtMSA1IDIgOCAyIDQtMSA0LTFWM3MtMSAxLTQgMS01LTItOC0yLTQgMS00IDF6Ij48L3BhdGggPjxsaW5lIHgxPSI0IiB5MT0iMjIiIHgyPSI0IiB5Mj0iMTUiPjwvbGluZT48L3N2Zz4=";

import { observer } from 'mobx-react-lite';
import { rootStore } from './stores/root-store';
import { javascriptGenerator } from 'blockly/javascript';
import { registerProcedureBlocks, setDerivWorkspace } from './lib/procedures';
import { botEngine, BotStats, Transaction, JournalMessage, contract_stages, TContractStage } from './lib/botEngine';
import AIAssistant from './components/AIAssistant';

import { ContractIcon, MarketLogo, CONTRACT_ICONS } from './components/Icons';



const STORAGE_KEY = 'bot_builder_persistent_workspace';

const DEFAULT_STRATEGY_XML = `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
    </variables>
    <block type="trade_definition" x="50" y="50">
      <statement name="SUBMARKET">
        <block type="trade_definition_market">
          <field name="MARKET_LIST">synthetic_index</field>
          <field name="SUBMARKET_LIST">random_index</field>
          <field name="SYMBOL_LIST">1HZ10V</field>
          <next>
            <block type="trade_definition_tradetype">
              <field name="TRADETYPECAT_LIST">digits</field>
              <field name="TRADETYPE_LIST">callput</field>
              <next>
                <block type="trade_definition_contracttype">
                  <field name="TYPE_LIST">both</field>
                  <next>
                    <block type="trade_definition_candleinterval">
                      <field name="CANDLEINTERVAL_LIST">60</field>
                      <next>
                        <block type="trade_definition_restartbuysell">
                          <field name="TIME_MACHINE_ENABLED">FALSE</field>
                          <next>
                            <block type="trade_definition_restartonerror">
                              <field name="RESTARTONERROR">TRUE</field>
                            </block>
                          </next>
                        </block>
                      </next>
                    </block>
                  </next>
                </block>
              </next>
            </block>
          </next>
        </block>
      </statement>
      <statement name="TRADE_OPTIONS">
        <block type="trade_definition_tradeoptions">
          <field name="DURATIONTYPE_LIST">t</field>
          <field name="BARRIER_TYPE">offset_plus</field>
          <field name="RUN_ON_EVERY_TICK">FALSE</field>
          <value name="DURATION">
            <shadow type="math_number">
              <field name="NUM">1</field>
            </shadow>
          </value>
          <value name="AMOUNT">
            <shadow type="math_number">
              <field name="NUM">0.35</field>
            </shadow>
          </value>
          <value name="BARRIER">
            <shadow type="math_number">
              <field name="NUM">0.5</field>
            </shadow>
          </value>
        </block>
      </statement>
    </block>
    <block type="before_purchase" x="50" y="650">
      <statement name="BEFOREPURCHASE_STACK">
        <block type="purchase">
          <field name="PURCHASE_LIST">RISE</field>
        </block>
      </statement>
    </block>
    <block type="during_purchase" x="700" y="50">
      <statement name="DURING_PURCHASE_STACK">
        <block type="controls_if">
          <value name="IF0">
            <block type="check_sell"></block>
          </value>
          <statement name="DO0">
            <block type="sell_at_market"></block>
          </statement>
        </block>
      </statement>
    </block>
    <block type="after_purchase" x="700" y="300">
      <statement name="AFTERPURCHASE_STACK">
        <block type="trade_again"></block>
      </statement>
    </block>
  </xml>
`;

const PATTERN_STRATEGY_XML = `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
    </variables>
    <block type="trade_definition" x="50" y="50">
      <statement name="SUBMARKET">
        <block type="trade_definition_market">
          <field name="MARKET_LIST">synthetic_index</field>
          <field name="SUBMARKET_LIST">random_index</field>
          <field name="SYMBOL_LIST">1HZ10V</field>
          <next>
            <block type="trade_definition_tradetype">
              <field name="TRADETYPECAT_LIST">digits</field>
              <field name="TRADETYPE_LIST">differs</field>
              <next>
                <block type="trade_definition_contracttype">
                  <field name="TYPE_LIST">both</field>
                  <next>
                    <block type="trade_definition_candleinterval">
                      <field name="CANDLEINTERVAL_LIST">60</field>
                      <next>
                        <block type="trade_definition_restartbuysell">
                          <field name="TIME_MACHINE_ENABLED">FALSE</field>
                          <next>
                            <block type="trade_definition_restartonerror">
                              <field name="RESTARTONERROR">TRUE</field>
                            </block>
                          </next>
                        </block>
                      </next>
                    </block>
                  </next>
                </block>
              </next>
            </block>
          </next>
        </block>
      </statement>
      <statement name="TRADE_OPTIONS">
        <block type="trade_definition_tradeoptions">
          <field name="DURATIONTYPE_LIST">t</field>
          <field name="BARRIER_TYPE">offset_plus</field>
          <field name="RUN_ON_EVERY_TICK">FALSE</field>
          <value name="DURATION">
            <shadow type="math_number">
              <field name="NUM">1</field>
            </shadow>
          </value>
          <value name="AMOUNT">
            <shadow type="math_number">
              <field name="NUM">0.35</field>
            </shadow>
          </value>
          <value name="PREDICTION">
            <shadow type="math_number">
              <field name="NUM">9</field>
            </shadow>
          </value>
        </block>
      </statement>
    </block>
    <block type="before_purchase" x="50" y="650">
      <statement name="BEFOREPURCHASE_STACK">
        <block type="scan_volatility_markets">
          <field name="CRITERION">pattern_alignment</field>
          <field name="AUTO_SWITCH">TRUE</field>
          <next>
            <block type="controls_if">
              <mutation else="1"></mutation>
              <value name="IF0">
                <block type="check_digit_pattern_sequence">
                  <field name="PATTERN">differs9_under9_under8</field>
                </block>
              </value>
              <statement name="DO0">
                <block type="set_entry_armed">
                  <field name="ARMED">TRUE</field>
                  <next>
                    <block type="controls_if">
                      <value name="IF0">
                        <block type="is_entry_armed"></block>
                      </value>
                      <statement name="DO0">
                        <block type="purchase">
                          <field name="PURCHASE_LIST">DIGITDIFF</field>
                        </block>
                      </statement>
                    </block>
                  </next>
                </block>
              </statement>
              <statement name="ELSE">
                <block type="set_entry_armed">
                  <field name="ARMED">FALSE</field>
                </block>
              </statement>
            </block>
          </next>
        </block>
      </statement>
    </block>
    <block type="during_purchase" x="720" y="50">
      <statement name="DURING_PURCHASE_STACK">
        <block type="controls_if">
          <value name="IF0">
            <block type="check_sell"></block>
          </value>
          <statement name="DO0">
            <block type="sell_at_market"></block>
          </statement>
        </block>
      </statement>
    </block>
    <block type="after_purchase" x="720" y="300">
      <statement name="AFTERPURCHASE_STACK">
        <block type="rotate_volatility_market">
          <field name="CONDITION">on_win</field>
          <next>
            <block type="trade_again"></block>
          </next>
        </block>
      </statement>
    </block>
  </xml>
`;

const HIGHER_LOWER_STRATEGY_XML = `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <variables>
    </variables>
    <block type="trade_definition" x="50" y="50">
      <statement name="SUBMARKET">
        <block type="trade_definition_market">
          <field name="MARKET_LIST">synthetic_index</field>
          <field name="SUBMARKET_LIST">random_index</field>
          <field name="SYMBOL_LIST">1HZ10V</field>
          <next>
            <block type="trade_definition_tradetype">
              <field name="TRADETYPECAT_LIST">callput</field>
              <field name="TRADETYPE_LIST">higherlower</field>
              <next>
                <block type="trade_definition_contracttype">
                  <field name="TYPE_LIST">HIGHER</field>
                  <next>
                    <block type="trade_definition_candleinterval">
                      <field name="CANDLEINTERVAL_LIST">60</field>
                      <next>
                        <block type="trade_definition_restartbuysell">
                          <field name="TIME_MACHINE_ENABLED">FALSE</field>
                          <next>
                            <block type="trade_definition_restartonerror">
                              <field name="RESTARTONERROR">TRUE</field>
                            </block>
                          </next>
                        </block>
                      </next>
                    </block>
                  </next>
                </block>
              </next>
            </block>
          </next>
        </block>
      </statement>
      <statement name="TRADE_OPTIONS">
        <block type="trade_definition_tradeoptions">
          <field name="DURATIONTYPE_LIST">t</field>
          <field name="BARRIER_TYPE">offset_plus</field>
          <field name="RUN_ON_EVERY_TICK">FALSE</field>
          <value name="DURATION">
            <shadow type="math_number">
              <field name="NUM">5</field>
            </shadow>
          </value>
          <value name="AMOUNT">
            <shadow type="math_number">
              <field name="NUM">0.35</field>
            </shadow>
          </value>
          <value name="BARRIER">
            <shadow type="math_number">
              <field name="NUM">0.37</field>
            </shadow>
          </value>
          <value name="TAKE_PROFIT">
            <shadow type="math_number">
              <field name="NUM">5</field>
            </shadow>
          </value>
          <value name="STOP_LOSS">
            <shadow type="math_number">
              <field name="NUM">10</field>
            </shadow>
          </value>
        </block>
      </statement>
      <statement name="BEFORE_PURCHASE">
        <block type="purchase">
          <field name="PURCHASE_LIST">HIGHER</field>
        </block>
      </statement>
      <statement name="AFTER_PURCHASE">
        <block type="controls_if">
          <mutation else="1"></mutation>
          <value name="IF0">
            <block type="contract_check_result">
              <field name="CHECK_RESULT">win</field>
            </block>
          </value>
          <statement name="DO0">
            <block type="notify">
              <field name="NOTIFICATION_TYPE">success</field>
              <field name="NOTIFICATION_SOUND">silent</field>
              <value name="MESSAGE">
                <shadow type="text">
                  <field name="TEXT">Higher Contract Won! Target Barrier breached.</field>
                </shadow>
              </value>
              <next>
                <block type="trade_again"></block>
              </next>
            </block>
          </statement>
          <statement name="ELSE">
            <block type="notify">
              <field name="NOTIFICATION_TYPE">warn</field>
              <field name="NOTIFICATION_SOUND">silent</field>
              <value name="MESSAGE">
                <shadow type="text">
                  <field name="TEXT">Contract Lost. Retrying...</field>
                </shadow>
              </value>
              <next>
                <block type="trade_again"></block>
              </next>
            </block>
          </statement>
        </block>
      </statement>
    </block>
  </xml>
`;

export default observer(function BotBuilder() {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceInstance, setWorkspaceInstance] = useState<Blockly.WorkspaceSvg | null>(null);
  
  // Use MobX observables from engine directly in observer render
  const isBotRunning = botEngine.isRunning;
  const botStatus = botEngine.status;
  const contractStage = botEngine.contractStage;
  
  const [progress, setProgress] = useState(0);
  const [isToolboxVisible, setIsToolboxVisible] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const activeTab = rootStore.run_panel.active_tab;
  const setActiveTab = rootStore.run_panel.setActiveTab;
  const [searchQuery, setSearchQuery] = useState('');
  
  // Use state only for UI elements, get data from engine directly in observer render
  const stats = botEngine.getStats();
  const transactions = botEngine.getTransactions();
  const journal = botEngine.getJournal();
  
  const TransactionRow = ({ tx, isSubRow = false, legIndex = 0 }: { tx: Transaction, isSubRow?: boolean, legIndex?: number }) => (
    <div 
      key={tx.id}
      className={cn(
        "grid grid-cols-3 px-3 py-4 border-b border-[#2d2f2f]/30 hover:bg-[#1a1c1c] items-center relative overflow-hidden",
        tx.result === 'pending' && "bg-[#1a1c1c]/30",
        isSubRow && "pl-8 py-2 bg-[#0e0e0e]/20"
      )}
    >
      {tx.result === 'pending' && (
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#00a79e]/50 to-transparent animate-shimmer" />
      )}
      
      {/* Left: Icons */}
      <div className="flex items-center space-x-2 mr-3">
        <MarketLogo symbol={tx.symbol} className={cn(isSubRow ? "w-6 h-6" : "w-8 h-8", "rounded-lg shadow-lg")} />
        <div className={cn(isSubRow ? "w-6 h-6" : "w-8 h-8", "bg-[#2d2f2f]/30 rounded-lg flex items-center justify-center border border-[#3d3f3f]/30 overflow-hidden")}>
          <div className="flex items-center justify-center backdrop-blur-sm w-full h-full p-1 text-[#818cf8]">
            {tx.type && CONTRACT_ICONS[tx.type.toUpperCase()] ? 
              React.cloneElement(CONTRACT_ICONS[tx.type.toUpperCase()] as React.ReactElement<{ className?: string }>, { className: "w-full h-full" }) : 
              <LayoutGrid size={isSubRow ? 12 : 18} />
            }
          </div>
        </div>
      </div>

      {/* Middle: Spots & Indicators */}
      <div className="flex flex-col items-center space-y-1 overflow-hidden">
        <div className="flex items-center space-x-2">
          {isSubRow ? (
            <div className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0",
              legIndex === 0 ? "bg-[#ff444f]" : "border border-[#aaaaaa]"
            )} />
          ) : (
            <div className="w-[12px] h-[12px] rounded-full bg-[#ff444f] flex items-center justify-center p-[2px] shadow-[0_0_8px_rgba(255,68,79,0.25)] shrink-0">
              <div className="w-full h-full rounded-full bg-white" />
            </div>
          )}
          {(tx.result === 'pending' && !tx.isVirtual) ? (
            <div className="h-3 w-16 bg-[#0a0b0d] rounded animate-pulse" />
          ) : (
            <span className={cn(isSubRow ? "text-[10px]" : "text-[12px]", "font-black text-white tracking-widest truncate")}>{tx.entrySpot}</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-[12px] h-[12px] rounded-full border-2 border-[#444444] shrink-0 overflow-hidden relative">
            {tx.result === 'pending' && (
              <motion.div 
                className="absolute inset-0 bg-[#00a79e]"
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </div>
          {(tx.result === 'pending' && !tx.exitSpot) ? (
            <div className="h-3 w-14 bg-[#0a0b0d] rounded animate-pulse opacity-50" />
          ) : (
            <span className={cn(
              isSubRow ? "text-[9px]" : "text-[11px]",
              "font-bold tracking-tight truncate",
              tx.result === 'pending' ? "text-[#00a79e]/70" : "text-[#888888]"
            )}>{tx.exitSpot}</span>
          )}
        </div>
      </div>

        {/* Right: Values */}
      <div className="flex flex-col items-end space-y-1">
        <div className={cn(isSubRow ? "text-[11px]" : "text-[13px]", "font-black text-white flex items-center gap-1.5")}>
          {tx.buyPrice.toFixed(2)} <span className="text-[9px] text-[#888] font-bold opacity-70">USD</span>
          {tx.isVirtual && (
            <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase font-black tracking-wider leading-none">Virtual</span>
          )}
        </div>
        
        {tx.result === 'pending' ? (
           <div className={cn(
             isSubRow ? "text-[12px]" : "text-[14px]",
             "font-black tracking-tighter flex items-baseline gap-0.5 opacity-60 animate-[pulse_0.8s_ease-in-out_infinite]",
             tx.profit >= 0 ? "text-[#00a79e]" : "text-[#ff444f]"
           )}>
             <span>{tx.profit >= 0 ? '+' : ''}{tx.profit.toFixed(2)}</span>
             <span className="text-[9px] font-bold">USD</span>
           </div>
        ) : (
          <div className="flex flex-col items-end">
            <div className={cn(
              isSubRow ? "text-[12px]" : "text-[14px]",
              "font-black tracking-tighter flex items-baseline gap-0.5",
              tx.profit >= 0 ? "text-[#00a79e]" : "text-[#ff444f]"
            )}>
              <span>{tx.profit >= 0 ? '+' : ''}{tx.profit.toFixed(2)}</span>
              <span className="text-[9px] font-bold">USD</span>
            </div>
            {tx.isVirtual && (
              <span className="text-[8px] text-[#aaaaaa]/60 uppercase font-black tracking-wider mt-0.5">
                Virtual Trade
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
  const analysis = botEngine.getAnalysis();
  const isRunPanelOpen = rootStore.run_panel.is_drawer_open;
  const setIsRunPanelOpen = rootStore.run_panel.toggleDrawer;
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isQuickStrategyModalOpen, setIsQuickStrategyModalOpen] = useState(false);
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
  const isResetModalOpen = rootStore.run_panel.is_dialog_open;
  const setIsResetModalOpen = (isOpen: boolean) => {
    if (isOpen) rootStore.run_panel.onClearStatClick();
    else rootStore.run_panel.onCloseDialog();
  };
  const [isDemoResetModalOpen, setIsDemoResetModalOpen] = useState(false);
  const [isWorkspaceResetModalOpen, setIsWorkspaceResetModalOpen] = useState(false);
  const [newVariableName, setNewVariableName] = useState('');
  const [variableModalCallback, setVariableModalCallback] = useState<((name: string | null) => void) | null>(null);
  const [botName, setBotName] = useState('otivo-strategy');
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [takeProfit, setTakeProfit] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(10);
  const [saveLocation, setSaveLocation] = useState<'local' | 'ready_bots'>('local');
  const [showNameError, setShowNameError] = useState(false);
  const [loadedBotInfo, setLoadedBotInfo] = useState<{ id: string, name: string }>({ id: 'custom_bot', name: 'Custom Bot' });
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Interfaces & States for Scheduled Alarms
  interface BotBuilderAlarm {
    id: string;
    time: string;
    label: string;
    enabled: boolean;
    triggeredToday?: string;
  }

  const [alarms, setAlarms] = useState<BotBuilderAlarm[]>(() => {
    try {
      const saved = localStorage.getItem('autobot_scheduled_alarms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAlarmSchedulerEnabled, setIsAlarmSchedulerEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autobot_alarm_scheduler_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isAutoResetEnabled, setIsAutoResetEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('botbuilder_auto_reset_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isAutoConfirmingReset, setIsAutoConfirmingReset] = useState<boolean>(false);
  const isAutoResetEnabledRef = useRef(isAutoResetEnabled);

  useEffect(() => {
    isAutoResetEnabledRef.current = isAutoResetEnabled;
    try {
      localStorage.setItem('botbuilder_auto_reset_enabled', String(isAutoResetEnabled));
    } catch (err) {
      console.error('Failed to save botbuilder_auto_reset_enabled:', err);
    }
  }, [isAutoResetEnabled]);

  const [newAlarmTime, setNewAlarmTime] = useState<string>('09:00:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState<string>('');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Auto Reset & Start After Take Profit states
  const [autoRestartAfterTp, setAutoRestartAfterTp] = useState<boolean>(() => {
    return localStorage.getItem('botbuilder_auto_restart_after_tp') === 'true';
  });
  const [autoRestartMaxTp, setAutoRestartMaxTp] = useState<number>(() => {
    const saved = localStorage.getItem('botbuilder_auto_restart_max_tp');
    return saved !== null ? Math.max(1, parseFloat(saved) || 50.0) : 50.0;
  });
  const [cumulativeSessionProfit, setCumulativeSessionProfit] = useState<number>(() => {
    const saved = sessionStorage.getItem('botbuilder_cumulative_session_profit');
    return saved !== null ? parseFloat(saved) || 0 : 0;
  });

  const autoRestartAfterTpRef = useRef<boolean>(autoRestartAfterTp);
  const autoRestartMaxTpRef = useRef<number>(autoRestartMaxTp);
  const cumulativeSessionProfitRef = useRef<number>(cumulativeSessionProfit);

  useEffect(() => {
    autoRestartAfterTpRef.current = autoRestartAfterTp;
    localStorage.setItem('botbuilder_auto_restart_after_tp', autoRestartAfterTp ? 'true' : 'false');
    (window as any).BOTBUILDER_AUTO_RESTART_AFTER_TP = autoRestartAfterTp;
  }, [autoRestartAfterTp]);

  useEffect(() => {
    autoRestartMaxTpRef.current = autoRestartMaxTp;
    localStorage.setItem('botbuilder_auto_restart_max_tp', autoRestartMaxTp.toString());
    (window as any).BOTBUILDER_AUTO_RESTART_MAX_TP = autoRestartMaxTp;
  }, [autoRestartMaxTp]);

  useEffect(() => {
    cumulativeSessionProfitRef.current = cumulativeSessionProfit;
    (window as any).BOTBUILDER_CUMULATIVE_SESSION_PROFIT = cumulativeSessionProfit;
  }, [cumulativeSessionProfit]);

  // Listen to engine auto-restart events
  useEffect(() => {
    const handleStatsReset = (e: any) => {
      const cum = e.detail?.cumulativeProfit ?? 0;
      setCumulativeSessionProfit(cum);
      cumulativeSessionProfitRef.current = cum;
      sessionStorage.setItem('botbuilder_cumulative_session_profit', cum.toString());
    };

    const handleMaxReached = (e: any) => {
      const cum = e.detail?.cumulativeProfit ?? 0;
      setCumulativeSessionProfit(cum);
      cumulativeSessionProfitRef.current = cum;
      sessionStorage.setItem('botbuilder_cumulative_session_profit', cum.toString());
      setAutoRestartAfterTp(false);
    };

    window.addEventListener('botbuilder_auto_restart_stats_reset', handleStatsReset);
    window.addEventListener('botbuilder_auto_restart_max_reached', handleMaxReached);
    return () => {
      window.removeEventListener('botbuilder_auto_restart_stats_reset', handleStatsReset);
      window.removeEventListener('botbuilder_auto_restart_max_reached', handleMaxReached);
    };
  }, []);

  const activeSessionProfit = Number((cumulativeSessionProfit + (stats.totalProfit || 0)).toFixed(2));

  const handleResetSessionProfit = () => {
    cumulativeSessionProfitRef.current = 0;
    setCumulativeSessionProfit(0);
    sessionStorage.removeItem('botbuilder_cumulative_session_profit');
    (window as any).BOTBUILDER_CUMULATIVE_SESSION_PROFIT = 0;
    rootStore.run_panel.clearStat();
    botEngine.resetStats();
    botEngine.getBotInterface().notify('info', 'Auto Start session profit counter reset to $0.00.');
  };

  // Save alarms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('autobot_scheduled_alarms', JSON.stringify(alarms));
    } catch (err) {
      console.error('Failed to save autobot_scheduled_alarms:', err);
    }
  }, [alarms]);

  // Save alarm scheduler switch state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('autobot_alarm_scheduler_enabled', String(isAlarmSchedulerEnabled));
    } catch (err) {
      console.error('Failed to save autobot_alarm_scheduler_enabled:', err);
    }
  }, [isAlarmSchedulerEnabled]);

  const isAlarmSchedulerEnabledRef = useRef(isAlarmSchedulerEnabled);
  useEffect(() => {
    isAlarmSchedulerEnabledRef.current = isAlarmSchedulerEnabled;
  }, [isAlarmSchedulerEnabled]);

  useEffect(() => {
    if (workspace.current) {
      // Small timeout to allow layout transitions to complete
      const timer = setTimeout(() => {
        if (workspace.current) {
          Blockly.svgResize(workspace.current);
          const toolboxDiv = blocklyDiv.current?.querySelector('.blocklyToolboxDiv') as HTMLElement;
          if (toolboxDiv) {
            toolboxDiv.style.display = 'none';
          }
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isToolboxVisible, isRunPanelOpen, activeCategory]);

  useEffect(() => {
    if (workspace.current) {
      // Override Blockly's default prompt for variable creation
      (Blockly as any).dialog.setPrompt((message: string, defaultValue: string, callback: (name: string | null) => void) => {
        setNewVariableName(defaultValue || '');
        setVariableModalCallback(() => callback);
        setIsVariableModalOpen(true);
      });
    }
  }, [workspace.current]);

  const confirmVariableCreation = () => {
    if (newVariableName.trim() && variableModalCallback) {
      variableModalCallback(newVariableName.trim());
      setIsVariableModalOpen(false);
      setNewVariableName('');
      setVariableModalCallback(null);
    }
  };

  const cancelVariableCreation = () => {
    if (variableModalCallback) {
      variableModalCallback(null);
      setIsVariableModalOpen(false);
      setNewVariableName('');
      setVariableModalCallback(null);
    }
  };

  useEffect(() => {
    botEngine.setTradeOptions({ takeProfit, stopLoss });
  }, [takeProfit, stopLoss]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 1024;

  useEffect(() => {
    if (isRunPanelOpen && isMobile) {
      setIsToolboxVisible(false);
      setIsAIAssistantOpen(false);
    }
  }, [isRunPanelOpen, isMobile]);

  useEffect(() => {
    if (isToolboxVisible && isMobile) {
      setIsRunPanelOpen(false);
      setIsAIAssistantOpen(false);
    }
  }, [isToolboxVisible, isMobile]);

  useEffect(() => {
    if (isAIAssistantOpen && isMobile) {
      setIsToolboxVisible(false);
      setIsRunPanelOpen(false);
    }
  }, [isAIAssistantOpen, isMobile]);

  useEffect(() => {
    const handleInsufficientBalance = () => {
      setActiveTab('journal');
    };

    const handlePrint = (message: string) => {
      setPrintMessage(message);
    };

    botEngine.on('insufficient_balance', handleInsufficientBalance);
    botEngine.on('print', handlePrint);
    return () => {
      botEngine.off('insufficient_balance', handleInsufficientBalance);
      botEngine.off('print', handlePrint);
    };
  }, []);

  useEffect(() => {
    if (!isBotRunning) {
      setProgress(0);
      return;
    }

    if (contractStage === contract_stages.PURCHASE_SENT) {
      setProgress(20);
      const interval = setInterval(() => {
        setProgress(prev => (prev < 40 ? prev + 1 : prev));
      }, 100);
      return () => clearInterval(interval);
    } else if (contractStage === contract_stages.PURCHASE_RECEIVED) {
      setProgress(40);
      const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 0.5 : prev));
      }, 200);
      return () => clearInterval(interval);
    } else if (contractStage === contract_stages.CONTRACT_CLOSED) {
      setProgress(100);
      const timer = setTimeout(() => {
        if (botEngine.getIsRunning()) {
          setProgress(0);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else if (contractStage === contract_stages.STARTING) {
      // Idle state, just a small pulse or low progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 15) return 10;
          return prev + 0.2;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [contractStage, isBotRunning]);

  const handleRunBot = async () => {
    if (isBotRunning) {
      botEngine.stop();
    } else {
      if (!workspace.current) return;
      try {
        const code = javascriptGenerator.workspaceToCode(workspace.current);
        console.log("Generated code:", code);
        
        const activeType = getActiveAccountType();
        const token = getActiveToken();
        const accId = getActiveAccountId();
        const connectionType = (localStorage.getItem('deriv_connection_type') || 'oauth') as 'oauth' | 'legacy';
        
        if (!token) {
          alert(`Please connect to your ${activeType} account first in the header.`);
          return;
        }
        
        if (!code || code.trim() === '') {
          alert('The workspace is empty or no code was generated. Please ensure your blocks are connected to a "Trade parameters" block.');
          return;
        }

        await botEngine.start(token, code, loadedBotInfo.id, loadedBotInfo.name, accId || undefined, connectionType);
      } catch (error) {
        console.error("Code generation error:", error);
        alert("Failed to generate code from blocks. Error: " + (error as Error).message);
      }
    }
  };

  const handleRunBotRef = useRef(handleRunBot);
  useEffect(() => {
    handleRunBotRef.current = handleRunBot;
  }, [handleRunBot]);

  // Real-Time Alarm Scheduler Clock & Trigger Engine
  useEffect(() => {
    const alarmTimer = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const timeHHMM = `${hours}:${minutes}`;
      const timeHHMMSS = `${hours}:${minutes}:${seconds}`;
      const dateTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      setCurrentTimeStr(timeHHMMSS);

      setAlarms(prevAlarms => {
        if (!isAlarmSchedulerEnabledRef.current) return prevAlarms;

        let hasTriggeredAny = false;
        const updated = prevAlarms.map(alarm => {
          if (!alarm.enabled) return alarm;

          // Check if time matches alarm setting (supports HH:mm or HH:mm:ss)
          const matchesTime = alarm.time === timeHHMM || alarm.time === timeHHMMSS;
          const triggerKey = `${dateTodayStr} ${alarm.time}`;

          if (matchesTime && alarm.triggeredToday !== triggerKey) {
            hasTriggeredAny = true;
            const alarmTitle = alarm.label ? `${alarm.label} (${alarm.time})` : `Scheduled Alarm ${alarm.time}`;

            if (!botEngine.isRunning) {
              botEngine.getBotInterface().notify('info', `⏰ Alarm Triggered: ${alarmTitle}! Starting Bot Builder automatically...`);
              setTimeout(() => {
                if (handleRunBotRef.current) {
                  handleRunBotRef.current();
                }
              }, 100);
            } else {
              botEngine.getBotInterface().notify('info', `⏰ Alarm Reached: ${alarmTitle} - Bot is currently running.`);
            }

            return {
              ...alarm,
              triggeredToday: triggerKey
            };
          }
          return alarm;
        });

        return hasTriggeredAny ? updated : prevAlarms;
      });
    }, 1000);

    return () => clearInterval(alarmTimer);
  }, []);

  // Real-Time Alarm Scheduler - Auto Reset after Stop Engine
  // Automatically opens the Reset Confirmation Modal and clicks "Ok" to clear summary, transactions, and journal
  const prevIsRunningRef = useRef(isBotRunning);
  const autoResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoConfirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoResetTimers = () => {
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }
    setIsAutoConfirmingReset(false);
  };

  useEffect(() => {
    // When bot transitions from running (true) to stopped (false)
    if (prevIsRunningRef.current && !isBotRunning) {
      if (isAutoResetEnabledRef.current) {
        clearAutoResetTimers();

        // Step 1: Wait a brief moment for completion messages, then automatically open the Reset modal (simulating clicking "Reset")
        autoResetTimeoutRef.current = setTimeout(() => {
          setIsResetModalOpen(true);
          setIsAutoConfirmingReset(true);
          botEngine.getBotInterface().notify('info', '⏰ Alarm Scheduler: Auto Reset modal opened.');

          // Step 2: Automatically trigger the "Ok" button (simulating clicking "Ok" to clear stats)
          autoConfirmTimeoutRef.current = setTimeout(() => {
            rootStore.run_panel.clearStat();
            setPrintMessage(null);
            setIsResetModalOpen(false);
            setIsAutoConfirmingReset(false);
            botEngine.getBotInterface().notify('success', '⏰ Alarm Scheduler: Auto Reset & Ok executed. All counters reset to zero.');
          }, 900); // 900ms visual buffer matching the user video demonstration
        }, 1200);
      }
    }
    prevIsRunningRef.current = isBotRunning;
  }, [isBotRunning]);

  useEffect(() => {
    return () => {
      clearAutoResetTimers();
    };
  }, []);

  const handleAddAlarm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAlarmTime) {
      botEngine.getBotInterface().notify('warn', 'Please enter a valid alarm time.');
      return;
    }

    let formattedTime = newAlarmTime.trim();
    if (formattedTime.length === 5) {
      formattedTime = `${formattedTime}:00`;
    }

    const alarmId = `alarm-${Date.now()}`;
    const newAlarmItem: BotBuilderAlarm = {
      id: alarmId,
      time: formattedTime,
      label: newAlarmLabel.trim() || `Alarm ${formattedTime}`,
      enabled: true
    };

    setAlarms(prev => [...prev, newAlarmItem]);
    setNewAlarmLabel('');
    botEngine.getBotInterface().notify('success', `⏰ Scheduled Alarm added for ${formattedTime}${newAlarmItem.label ? ` (${newAlarmItem.label})` : ''}`);
  };

  const handleToggleAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => {
      if (a.id === id) {
        const nextState = !a.enabled;
        botEngine.getBotInterface().notify('info', `Alarm [${a.time}] turned ${nextState ? 'ON' : 'OFF'}`);
        return { ...a, enabled: nextState };
      }
      return a;
    }));
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
    botEngine.getBotInterface().notify('info', 'Alarm schedule removed.');
  };

  const handleSaveWorkspace = () => {
    setIsSaveModalOpen(true);
    setShowNameError(false);
  };

  const confirmSave = () => {
    if (!botName.trim()) {
      setShowNameError(true);
      return;
    }
    
    if (!workspace.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspace.current);
    const xmlText = Blockly.Xml.domToPrettyText(xml);

    if (saveLocation === 'ready_bots') {
      const userBotsJson = localStorage.getItem('user_ready_bots');
      const userBots = userBotsJson ? JSON.parse(userBotsJson) : [];
      
      const newBot = {
        id: `user-bot-${Date.now()}`,
        name: botName,
        description: 'User saved strategy',
        xml: xmlText,
        timestamp: Date.now()
      };
      
      userBots.unshift(newBot);
      localStorage.setItem('user_ready_bots', JSON.stringify(userBots));
      setLoadedBotInfo({ id: newBot.id, name: newBot.name });
      localStorage.setItem('loaded_bot_info', JSON.stringify({ id: newBot.id, name: newBot.name }));
      alert('Bot saved to Ready Bots!');
    } else {
      const blob = new Blob([xmlText], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${botName}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    setIsSaveModalOpen(false);
  };

  const handleZoomIn = () => {
    if (!workspace.current) return;
    workspace.current.zoom(0, 0, 1);
  };

  const handleZoomOut = () => {
    if (!workspace.current) return;
    workspace.current.zoom(0, 0, -1);
  };

  const handleResetZoom = () => {
    if (!workspace.current) return;
    workspace.current.setScale(1);
    workspace.current.scrollCenter();
  };

  const handleQuickStrategy = () => {
    setIsQuickStrategyModalOpen(true);
  };

  const loadStrategyTemplate = (templateType: 'pattern_scanning' | 'default' | 'higher_lower') => {
    let xmlString = DEFAULT_STRATEGY_XML;
    if (templateType === 'pattern_scanning') xmlString = PATTERN_STRATEGY_XML;
    else if (templateType === 'higher_lower') xmlString = HIGHER_LOWER_STRATEGY_XML;

    if (workspace.current) {
      try {
        workspace.current.clear();
        const xml = (Blockly as any).utils?.xml?.textToDom(xmlString.trim()) || (Blockly as any).Xml?.textToDom(xmlString.trim());
        Blockly.Xml.domToWorkspace(xml, workspace.current);
        workspace.current.scrollCenter();
        workspace.current.getAllBlocks(false).forEach(block => {
          if (block.initSvg) block.initSvg();
          if (block.render) block.render();
        });
        Blockly.svgResize(workspace.current);
        let msg = 'Standard default strategy loaded.';
        if (templateType === 'pattern_scanning') msg = '🎯 Digit Pattern & Volatility Scanning Strategy loaded successfully!';
        else if (templateType === 'higher_lower') msg = '📈 Higher / Lower (Barrier Offset) Strategy loaded successfully!';
        botEngine.getBotInterface().notify('info', msg);
      } catch (e) {
        console.error('Error loading template strategy:', e);
      }
    }
    setIsQuickStrategyModalOpen(false);
  };

  const handleResetWorkspace = () => {
    setIsWorkspaceResetModalOpen(true);
  };

  const confirmResetWorkspace = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('load_bot_xml');
    localStorage.removeItem('loaded_bot_info');
    
    if (workspace.current) {
      try {
        workspace.current.clear();
        const xml = (Blockly as any).utils?.xml?.textToDom(DEFAULT_STRATEGY_XML.trim()) || (Blockly as any).Xml?.textToDom(DEFAULT_STRATEGY_XML.trim());
        Blockly.Xml.domToWorkspace(xml, workspace.current);
        workspace.current.scrollCenter();
        workspace.current.getAllBlocks(false).forEach(block => {
          if (block.initSvg) block.initSvg();
          if (block.render) block.render();
        });
        Blockly.svgResize(workspace.current);
      } catch (e) {
        console.error('Error during live workspace reset:', e);
        // Fallback to reload if live reset fails
        window.location.reload();
      }
    }
    
    setIsWorkspaceResetModalOpen(false);
  };

  const handleTutorial = () => {
    window.open('https://deriv.com/bot-builder-tutorial', '_blank');
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const xmlText = e.target?.result as string;
      if (workspace.current && xmlText) {
        try {
          // Robust XML parsing
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          const xml = xmlDoc.documentElement;

          if (xml.tagName.toLowerCase() === 'xml' || xml.tagName.toLowerCase() === 'block') {
            workspace.current.clear();
            
            // Handle both full workspace XML and single block XML
            if (xml.tagName.toLowerCase() === 'block') {
              const newXml = Blockly.utils.xml.createElement('xml');
              newXml.appendChild(xml);
              Blockly.Xml.domToWorkspace(newXml, workspace.current);
            } else {
              // Ensure variables are created first
              const variables = xml.getElementsByTagName('variables')[0];
              if (variables) {
                Blockly.Xml.domToVariables(variables, workspace.current);
              }
              Blockly.Xml.domToWorkspace(xml, workspace.current);

              // Resolve any loader blocks
              const loaderBlocks = xml.getElementsByTagName('block');
              for (let i = 0; i < loaderBlocks.length; i++) {
                const block = loaderBlocks[i];
                if (block.getAttribute('type') === 'loader') {
                  const urlField = block.getElementsByTagName('field')[0];
                  if (urlField && urlField.getAttribute('name') === 'URL') {
                    const url = urlField.textContent;
                    if (url && url.startsWith('http')) {
                      try {
                        const response = await fetch(url);
                        const subText = await response.text();
                        const subXmlDoc = parser.parseFromString(subText, "text/xml");
                        const subXml = subXmlDoc.documentElement;
                        Blockly.Xml.appendDomToWorkspace(subXml, workspace.current);
                      } catch (err) {
                        console.error("Failed to load sub-strategy:", err);
                      }
                    }
                  }
                }
              }
            }
            
            // Ensure all blocks are rendered correctly
            setTimeout(() => {
              if (workspace.current) {
                workspace.current.getAllBlocks(false).forEach(block => {
                  if (block.initSvg) block.initSvg();
                  if (block.render) block.render();
                });
                Blockly.svgResize(workspace.current);
              }
            }, 100);
            
            console.log("XML imported successfully");
          } else {
            throw new Error("Invalid XML root element: " + xml.tagName);
          }
        } catch (err) {
          console.error("Error importing XML:", err);
          alert("Failed to import XML. Please ensure it is a valid Blockly XML file. Error: " + (err as Error).message);
        }
      }
    };
    reader.readAsText(file);
    // Reset input value to allow importing the same file again
    event.target.value = '';
  };

  useEffect(() => {
    if (!blocklyDiv.current) return;

    const filterSymbols = (options: [string, string][]) => {
      const isLegacy = localStorage.getItem('deriv_connection_type') === 'legacy';
      if (isLegacy) return options;
      const restricted = ['1HZ150V', '1HZ200V', '1HZ250V', '1HZ300V'];
      return options.filter(opt => !restricted.includes(opt[1]));
    };

    // Custom Block Definitions
    Blockly.Blocks['trade'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Trade parameters (Legacy)");
        this.appendDummyInput()
            .appendField("Market:")
            .appendField(new Blockly.FieldDropdown([
              ["Derived", "synthetic_index"],
              ["Forex", "forex"],
              ["Indices", "indices"],
              ["Commodities", "commodities"]
            ]), "MARKET_LIST")
            .appendField("Submarket:")
            .appendField(new Blockly.FieldDropdown([
              ["Continuous Indices", "random_index"],
              ["Forex Basket", "forex_basket"],
              ["Daily Reset Indices", "daily_reset_indices"],
              ["Crash/Boom Indices", "crash_boom_indices"],
              ["Commodities Basket", "commodities_basket"],
              ["Jump Indices", "jump_indices"],
              ["Range Break Indices", "range_break_indices"],
              ["Step Indices", "step_indices"]
            ]), "SUBMARKET_LIST")
            .appendField("Symbol:")
            .appendField(new Blockly.FieldDropdown(() => filterSymbols([
              ["Volatility 10 (1s) Index", "1HZ10V"],
              ["Volatility 10 Index", "R_10"],
              ["Volatility 15 (1s) Index", "1HZ15V"],
              ["Volatility 25 (1s) Index", "1HZ25V"],
              ["Volatility 25 Index", "R_25"],
              ["Volatility 30 (1s) Index", "1HZ30V"],
              ["Volatility 50 (1s) Index", "1HZ50V"],
              ["Volatility 50 Index", "R_50"],
              ["Volatility 75 (1s) Index", "1HZ75V"],
              ["Volatility 75 Index", "R_75"],
              ["Volatility 90 (1s) Index", "1HZ90V"],
              ["Volatility 100 (1s) Index", "1HZ100V"],
              ["Volatility 100 Index", "R_100"],
              ["Volatility 150 (1s) Index", "1HZ150V"],
              ["Volatility 200 (1s) Index", "1HZ200V"],
              ["Volatility 250 (1s) Index", "1HZ250V"],
              ["Volatility 300 (1s) Index", "1HZ300V"],
              ["Boom 300 Index", "BOOM300N"],
              ["Boom 500 Index", "BOOM500"],
              ["Boom 600 Index", "BOOM600"],
              ["Boom 900 Index", "BOOM900"],
              ["Boom 1000 Index", "BOOM1000"],
              ["Crash 300 Index", "CRASH300N"],
              ["Crash 500 Index", "CRASH500"],
              ["Crash 600 Index", "CRASH600"],
              ["Crash 900 Index", "CRASH900"],
              ["Crash 1000 Index", "CRASH1000"],
              ["Jump 10 Index", "JD10"],
              ["Jump 25 Index", "JD25"],
              ["Jump 50 Index", "JD50"],
              ["Jump 75 Index", "JD75"],
              ["Jump 100 Index", "JD100"],
              ["Jump 150 Index", "JD150"],
              ["Jump 200 Index", "JD200"],
              ["Bear Market Index", "RDBEAR"],
              ["Bull Market Index", "RDBULL"]
            ])), "SYMBOL_LIST");
        this.appendDummyInput()
            .appendField("Trade Type Category:")
            .appendField(new Blockly.FieldDropdown([
              ["Up/Down", "callput"],
              ["Higher/Lower", "higherlower"],
              ["Touch/No Touch", "touchnotouch"],
              ["In/Out", "staysinout"],
              ["Asians", "asian"],
              ["Digits", "digits"],
              ["Reset Call/Reset Put", "resetcallput"],
              ["High/Low Ticks", "highlowticks"],
              ["Only Ups/Only Downs", "onlyuponslydowns"],
              ["Multipliers", "multipliers"],
              ["Accumulators", "accumulator"]
            ]), "TRADETYPECAT_LIST")
            .appendField("Trade Type:")
            .appendField(new Blockly.FieldDropdown([
              ["Rise/Fall", "risefall"],
              ["Match/Diff", "matchdiff"]
            ]), "TRADETYPE_LIST");
        this.appendDummyInput()
            .appendField("Contract Type:")
            .appendField(new Blockly.FieldDropdown([
              ["Both", "both"],
              ["Rise", "rise"],
              ["Fall", "fall"]
            ]), "TYPE_LIST")
            .appendField("Interval:")
            .appendField(new Blockly.FieldDropdown([
              ["1 minute", "60"],
              ["2 minutes", "120"],
              ["5 minutes", "300"]
            ]), "CANDLEINTERVAL_LIST");
        this.appendDummyInput()
            .appendField("Restart on Buy/Sell:")
            .appendField(new Blockly.FieldDropdown([
              ["Yes", "TRUE"],
              ["No", "FALSE"]
            ]), "TIME_MACHINE_ENABLED")
            .appendField("Restart on error:")
            .appendField(new Blockly.FieldDropdown([
              ["Yes", "TRUE"],
              ["No", "FALSE"]
            ]), "RESTARTONERROR");
        this.appendStatementInput("INITIALIZATION")
            .setCheck(null)
            .appendField("Run once at start:");
        this.setStyle('trade_parameters');
      }
    };

    Blockly.Blocks['trade_definition'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(TRADE_PARAMS_ICON, 16, 16, "*"))
            .appendField("1. Trade parameters");
        this.appendStatementInput("SUBMARKET").setCheck(null);
        this.appendDummyInput()
            .appendField("Run once at start:");
        this.appendStatementInput("INITIALIZATION").setCheck(null);
        this.appendDummyInput()
            .appendField("Trade options:");
        this.appendStatementInput("TRADE_OPTIONS").setCheck(null);
        this.setColour("#065f86");
        this.setTooltip("Define your trade parameters here.");
        this.setHelpUrl("");
      }
    };

    Blockly.Blocks['trade_definition_market'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Market:")
            .appendField(new Blockly.FieldDropdown([
              ["Derived", "synthetic_index"],
              ["Forex", "forex"],
              ["Indices", "indices"],
              ["Commodities", "commodities"]
            ]), "MARKET_LIST")
            .appendField(">")
            .appendField(new Blockly.FieldDropdown([
              ["Continuous Indices", "random_index"],
              ["Forex Basket", "forex_basket"],
              ["Daily Reset Indices", "daily_reset_indices"],
              ["Crash/Boom Indices", "crash_boom_indices"],
              ["Commodities Basket", "commodities_basket"],
              ["Jump Indices", "jump_indices"],
              ["Range Break Indices", "range_break_indices"],
              ["Step Indices", "step_indices"]
            ]), "SUBMARKET_LIST")
            .appendField(">")
            .appendField(new Blockly.FieldDropdown(() => filterSymbols([
              ["Volatility 10 (1s) Index", "1HZ10V"],
              ["Volatility 10 Index", "R_10"],
              ["Volatility 15 (1s) Index", "1HZ15V"],
              ["Volatility 25 (1s) Index", "1HZ25V"],
              ["Volatility 25 Index", "R_25"],
              ["Volatility 30 (1s) Index", "1HZ30V"],
              ["Volatility 50 (1s) Index", "1HZ50V"],
              ["Volatility 50 Index", "R_50"],
              ["Volatility 75 (1s) Index", "1HZ75V"],
              ["Volatility 75 Index", "R_75"],
              ["Volatility 90 (1s) Index", "1HZ90V"],
              ["Volatility 100 (1s) Index", "1HZ100V"],
              ["Volatility 100 Index", "R_100"],
              ["Volatility 150 (1s) Index", "1HZ150V"],
              ["Volatility 200 (1s) Index", "1HZ200V"],
              ["Volatility 250 (1s) Index", "1HZ250V"],
              ["Volatility 300 (1s) Index", "1HZ300V"],
              ["Boom 300 Index", "BOOM300N"],
              ["Boom 500 Index", "BOOM500"],
              ["Boom 600 Index", "BOOM600"],
              ["Boom 900 Index", "BOOM900"],
              ["Boom 1000 Index", "BOOM1000"],
              ["Crash 300 Index", "CRASH300N"],
              ["Crash 500 Index", "CRASH500"],
              ["Crash 600 Index", "CRASH600"],
              ["Crash 900 Index", "CRASH900"],
              ["Crash 1000 Index", "CRASH1000"],
              ["Jump 10 Index", "JD10"],
              ["Jump 25 Index", "JD25"],
              ["Jump 50 Index", "JD50"],
              ["Jump 75 Index", "JD75"],
              ["Jump 100 Index", "JD100"],
              ["Bull Market Index", "RDBULL"],
              ["Bear Market Index", "RDBEAR"]
            ])), "SYMBOL_LIST");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      },
      onchange: function(event: any) {
        if (!this.workspace || (event.type !== Blockly.Events.BLOCK_CHANGE && event.type !== Blockly.Events.FINISHED_LOADING)) return;
        if (event.blockId !== this.id) return;

        const symbol = this.getFieldValue('SYMBOL_LIST');
        if (symbol) {
          localStorage.setItem('analysis_symbol', symbol);
          window.dispatchEvent(new CustomEvent('analysis_market_sync', { detail: { symbol } }));
          botEngine.getBotInterface().switchMarket(symbol);
        }
      }
    };

    delete (Blockly.Blocks as any)['trade_definition_tradetype'];
    Blockly.Blocks['trade_definition_tradetype'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Trade Type:")
            .appendField(new Blockly.FieldDropdown([
              ["Up/Down", "callput"],
              ["Touch/No Touch", "touchnotouch"],
              ["In/Out", "staysinout"],
              ["Asians", "asian"],
              ["Digits", "digits"],
              ["Reset Call/Reset Put", "resetcallput"],
              ["High/Low Ticks", "highlowticks"],
              ["Only Ups/Only Downs", "runhighlow"],
              ["Multipliers", "multipliers"],
              ["Accumulators", "accumulator"]
            ]), "TRADETYPECAT_LIST")
            .appendField(">")
            .appendField(new Blockly.FieldDropdown(function() {
              const block = (this as any).getSourceBlock ? (this as any).getSourceBlock() : null;
              const cat = block ? block.getFieldValue('TRADETYPECAT_LIST') : 'callput';
              if (cat === 'callput') {
                return [
                  ["Rise/Fall", "callput"],
                  ["Higher/Lower", "higherlower"]
                ];
              }
              if (cat === 'higherlower') {
                return [
                  ["Higher/Lower", "higherlower"]
                ];
              }
              if (cat === 'digits') {
                return [
                  ["Matches/Differs", "matchdiff"],
                  ["Over/Under", "overunder"],
                  ["Even/Odd", "evenodd"]
                ];
              }
              if (cat === 'runhighlow') {
                return [
                  ["Only Ups/Only Downs", "runhighlow"]
                ];
              }
              if (cat === 'accumulator') {
                return [
                  ["Accumulator", "accumulator"]
                ];
              }
              return [
                ["Rise/Fall", "callput"],
                ["Matches/Differs", "matchdiff"],
                ["Over/Under", "overunder"],
                ["Even/Odd", "evenodd"],
                ["Only Ups/Only Downs", "runhighlow"],
                ["Buy", "buy"]
              ];
            }), "TRADETYPE_LIST");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      },
      onchange: function(event: any) {
        if (!this.workspace || this.workspace.isDragging()) return;
        const cat = this.getFieldValue('TRADETYPECAT_LIST');
        const type = this.getFieldValue('TRADETYPE_LIST');
        if (cat === 'higherlower' && type !== 'higherlower') {
          this.setFieldValue('higherlower', 'TRADETYPE_LIST');
        }
        const allBlocks = this.workspace.getAllBlocks(false);
        const contractBlock = allBlocks.find((b: any) => b.type === 'trade_definition_contracttype');
        if (contractBlock) {
          const cVal = contractBlock.getFieldValue('TYPE_LIST');
          if ((type === 'higherlower' || cat === 'higherlower') && cVal !== 'HIGHER' && cVal !== 'LOWER' && cVal !== 'both') {
            contractBlock.setFieldValue('HIGHER', 'TYPE_LIST');
          }
        }
        const optionsBlock = allBlocks.find((b: any) => b.type === 'trade_definition_tradeoptions');
        if (optionsBlock && optionsBlock.onchange) {
          optionsBlock.onchange({ type: Blockly.Events.BLOCK_CHANGE });
        }
      }
    };

    delete (Blockly.Blocks as any)['trade_definition_contracttype'];
    Blockly.Blocks['trade_definition_contracttype'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Contract Type:")
            .appendField(new Blockly.FieldDropdown(function() {
              const block = (this as any).getSourceBlock ? (this as any).getSourceBlock() : null;
              const ws = block?.workspace;
              let tradeType = '';
              let tradeCat = '';
              if (ws) {
                const ttBlock = ws.getAllBlocks(false).find((b: any) => b.type === 'trade_definition_tradetype');
                if (ttBlock) {
                  tradeType = ttBlock.getFieldValue('TRADETYPE_LIST') || '';
                  tradeCat = ttBlock.getFieldValue('TRADETYPECAT_LIST') || '';
                }
              }

              if (tradeType === 'higherlower' || tradeCat === 'higherlower') {
                return [
                  ["Higher", "HIGHER"],
                  ["Lower", "LOWER"],
                  ["Both (Higher & Lower)", "both"]
                ];
              }
              if (tradeType === 'callput' || tradeCat === 'callput') {
                return [
                  ["Rise", "rise"],
                  ["Fall", "fall"],
                  ["Both", "both"],
                  ["Rise (Allow Equals)", "RISE_E"],
                  ["Fall (Allow Equals)", "FALL_E"]
                ];
              }
              if (tradeType === 'matchdiff') {
                return [
                  ["Matches", "DIGITMATCH"],
                  ["Differs", "DIGITDIFF"],
                  ["Both", "both"]
                ];
              }
              if (tradeType === 'overunder') {
                return [
                  ["Over", "DIGITOVER"],
                  ["Under", "DIGITUNDER"],
                  ["Both", "both"]
                ];
              }
              if (tradeType === 'evenodd') {
                return [
                  ["Even", "DIGITEVEN"],
                  ["Odd", "DIGITODD"],
                  ["Both", "both"]
                ];
              }
              if (tradeType === 'runhighlow' || tradeCat === 'runhighlow') {
                return [
                  ["Only Ups", "RUNHIGH"],
                  ["Only Downs", "RUNLOW"],
                  ["Both", "both"]
                ];
              }
              if (tradeType === 'accumulator' || tradeCat === 'accumulator') {
                return [
                  ["Accumulator", "ACCU"]
                ];
              }

              return [
                ["Higher", "HIGHER"],
                ["Lower", "LOWER"],
                ["Both", "both"],
                ["Rise", "rise"],
                ["Fall", "fall"],
                ["Rise (Allow Equals)", "RISE_E"],
                ["Fall (Allow Equals)", "FALL_E"],
                ["Digit Under", "DIGITUNDER"],
                ["Digit Over", "DIGITOVER"],
                ["Digit Even", "DIGITEVEN"],
                ["Digit Odd", "DIGITODD"],
                ["Digit Match", "DIGITMATCH"],
                ["Digit Differ", "DIGITDIFF"],
                ["Only Ups", "RUNHIGH"],
                ["Only Downs", "RUNLOW"],
                ["Accumulator", "ACCU"],
                ["Buy", "buy"]
              ];
            }), "TYPE_LIST");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    delete (Blockly.Blocks as any)['trade_definition_candleinterval'];
    Blockly.Blocks['trade_definition_candleinterval'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Default Candle Interval:")
            .appendField(new Blockly.FieldDropdown([["1 minute", "60"], ["2 minutes", "120"], ["5 minutes", "300"]]), "CANDLEINTERVAL_LIST");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    delete (Blockly.Blocks as any)['trade_definition_tradeoptions'];
    Blockly.Blocks['trade_definition_tradeoptions'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Duration:")
            .appendField(new Blockly.FieldDropdown([["Ticks", "t"], ["Seconds", "s"], ["Minutes", "m"], ["Hours", "h"], ["Days", "d"]]), "DURATIONTYPE_LIST");
        this.appendValueInput("DURATION")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("Stake: USD");
        this.appendValueInput("AMOUNT")
            .setCheck("Number");
        this.appendDummyInput('STAKE_INFO')
            .appendField("(min: 0.35 - max: 50000)");
        this.appendDummyInput()
            .appendField("Take Profit: USD");
        this.appendValueInput("TAKE_PROFIT")
            .setCheck("Number");
        this.appendDummyInput()
            .appendField("Stop Loss: USD");
        this.appendValueInput("STOP_LOSS")
            .setCheck("Number");
        this.appendDummyInput('PREDICTION_LABEL')
            .appendField("Prediction:");
        this.appendValueInput("PREDICTION")
            .setCheck("Number");
        this.appendDummyInput('BARRIER_LABEL')
            .appendField("Barrier Offset:");
        this.appendDummyInput('BARRIER_TYPE')
            .appendField(new Blockly.FieldDropdown([["Offset +", "offset_plus"], ["Offset -", "offset_minus"], ["Absolute", "absolute"]]), "BARRIER_TYPE");
        this.appendValueInput("BARRIER")
            .setCheck(["Number", "String"]);
        this.getInput('PREDICTION_LABEL')?.setVisible(false);
        this.getInput('PREDICTION')?.setVisible(false);
        this.getInput('BARRIER_LABEL')?.setVisible(false);
        this.getInput('BARRIER_TYPE')?.setVisible(false);
        this.getInput('BARRIER')?.setVisible(false);
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      },
      onchange: function(event: any) {
        if (!this.workspace || this.workspace.isDragging() || (event.type !== Blockly.Events.BLOCK_MOVE && event.type !== Blockly.Events.BLOCK_CHANGE && event.type !== Blockly.Events.FINISHED_LOADING)) {
          return;
        }
        
        const allBlocks = this.workspace.getAllBlocks(false);
        const tradeTypeBlock = allBlocks.find((b: any) => b.type === 'trade_definition_tradetype');
        const contractTypeBlock = allBlocks.find((b: any) => b.type === 'trade_definition_contracttype');
        const purchaseBlocks = allBlocks.filter((b: any) => b.type === 'purchase');
        
        let showPrediction = false;
        let showBarrier = false;
        if (tradeTypeBlock) {
          const tradeType = tradeTypeBlock.getFieldValue('TRADETYPE_LIST');
          const tradeCat = tradeTypeBlock.getFieldValue('TRADETYPECAT_LIST');
          showPrediction = (tradeType === 'matchdiff' || tradeType === 'overunder' || tradeCat === 'digits');
          showBarrier = (tradeType === 'higherlower' || tradeCat === 'higherlower');
        }
        if (contractTypeBlock) {
          const cType = contractTypeBlock.getFieldValue('TYPE_LIST');
          if (cType === 'HIGHER' || cType === 'LOWER' || (showBarrier && cType === 'both')) {
            showBarrier = true;
          }
        }
        if (!showBarrier && purchaseBlocks.some((b: any) => {
          const p = b.getFieldValue('PURCHASE_LIST');
          return p === 'HIGHER' || p === 'LOWER';
        })) {
          showBarrier = true;
        }

        const predictionLabel = this.getInput('PREDICTION_LABEL');
        const predictionInput = this.getInput('PREDICTION');
        const barrierLabel = this.getInput('BARRIER_LABEL');
        const barrierTypeInput = this.getInput('BARRIER_TYPE');
        const barrierInput = this.getInput('BARRIER');
        
        if (predictionLabel && predictionInput) {
          predictionLabel.setVisible(showPrediction);
          predictionInput.setVisible(showPrediction);
        }

        if (barrierLabel && barrierTypeInput && barrierInput) {
          barrierLabel.setVisible(showBarrier);
          barrierTypeInput.setVisible(showBarrier);
          barrierInput.setVisible(showBarrier);
        }

        // If Higher/Lower (showBarrier), ensure minimum duration is 5 ticks per Deriv API spec
        const durationType = this.getFieldValue('DURATIONTYPE_LIST');
        if (showBarrier) {
          if (durationType === 't') {
            const durBlock = this.getInputTargetBlock('DURATION');
            if (durBlock && durBlock.type === 'math_number') {
              const currentDur = parseFloat(durBlock.getFieldValue('NUM'));
              if (!isNaN(currentDur) && currentDur < 5) {
                durBlock.setFieldValue('5', 'NUM');
              }
            }
          }
        }

        if (this.rendered) {
          this.render();
        }
      }
    };

    Blockly.Blocks['trade_definition_accumulator'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Accumulator parameters:");
        this.appendDummyInput()
            .appendField("Growth Rate:")
            .appendField(new Blockly.FieldDropdown([["1%", "0.01"], ["2%", "0.02"], ["3%", "0.03"], ["4%", "0.04"], ["5%", "0.05"]]), "GROWTHRATE_LIST");
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("Stake: USD");
        this.appendValueInput("TAKE_PROFIT")
            .setCheck("Number")
            .appendField("Take Profit: USD");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['accu_tp_limit'] = {
      init: function() {
        this.appendValueInput("PERCENT")
            .setCheck("Number")
            .appendField("expected_ACC_profit with: % return");
        this.setOutput(true, "Number");
        this.setColour("#ffc107");
        this.setTooltip("Returns the expected profit amount based on a percentage of the current stake.");
        this.setHelpUrl("");
      }
    };

    Blockly.Blocks['no_of_runs'] = {
      init: function() {
        this.appendValueInput("NO_OF_RUNS")
            .setCheck("Number")
            .appendField("No of Runs:");
        this.setOutput(true, "Number");
        this.setColour("#ffc107");
        this.setTooltip("Limits trading to a target number of winning runs (wins). Losses do not count towards the target and will be recovered before stopping.");
        this.setHelpUrl("");
      }
    };

    Blockly.Blocks['trade_definition_restartbuysell'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Restart buy/sell on error (disable for better performance):")
            .appendField(new Blockly.FieldCheckbox("FALSE"), "TIME_MACHINE_ENABLED");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['trade_definition_restartonerror'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Restart last trade on error (bot ignores the unsuccessful trade):")
            .appendField(new Blockly.FieldCheckbox("TRUE"), "RESTARTONERROR");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['trade_definition_switch_market'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Switch Market to:")
            .appendField(new Blockly.FieldDropdown(() => filterSymbols([
              ["Volatility 10 (1s) Index", "1HZ10V"],
              ["Volatility 10 Index", "R_10"],
              ["Volatility 15 (1s) Index", "1HZ15V"],
              ["Volatility 25 (1s) Index", "1HZ25V"],
              ["Volatility 25 Index", "R_25"],
              ["Volatility 30 (1s) Index", "1HZ30V"],
              ["Volatility 50 (1s) Index", "1HZ50V"],
              ["Volatility 50 Index", "R_50"],
              ["Volatility 75 (1s) Index", "1HZ75V"],
              ["Volatility 75 Index", "R_75"],
              ["Volatility 90 (1s) Index", "1HZ90V"],
              ["Volatility 100 (1s) Index", "1HZ100V"],
              ["Volatility 100 Index", "R_100"],
              ["Volatility 150 (1s) Index", "1HZ150V"],
              ["Volatility 200 (1s) Index", "1HZ200V"],
              ["Volatility 250 (1s) Index", "1HZ250V"],
              ["Volatility 300 (1s) Index", "1HZ300V"],
              ["Jump 10 Index", "JD10"],
              ["Jump 25 Index", "JD25"],
              ["Jump 50 Index", "JD50"],
              ["Jump 75 Index", "JD75"],
              ["Jump 100 Index", "JD100"],
              ["Bull Market Index", "RDBULL"],
              ["Bear Market Index", "RDBEAR"]
            ])), "SYMBOL_LIST");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
        this.setTooltip("Switches the trading market dynamically.");
      }
    };

    Blockly.Blocks['scan_volatility_markets'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(TRADE_PARAMS_ICON, 16, 16, "*"))
            .appendField("Scan Volatility 10 (1s) to 100 Markets");
        this.appendDummyInput()
            .appendField("Select Best by:")
            .appendField(new Blockly.FieldDropdown([
              ["Statistical Edge & Win Rate", "statistical_edge"],
              ["Pattern Alignment (Differs / Over-Under)", "pattern_alignment"],
              ["Coldest Digit (Highest Overdue Gap)", "coldest_digit"],
              ["Dominant High-Frequency Digit", "dominant_digit"]
            ]), "CRITERION");
        this.appendDummyInput()
            .appendField("Auto-Switch to Best Market:")
            .appendField(new Blockly.FieldDropdown([
              ["TRUE (Trade on Best Market)", "TRUE"],
              ["FALSE (Only Find)", "FALSE"]
            ]), "AUTO_SWITCH");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#ff9800");
        this.setTooltip("Scans all Volatility 10 (1s) to 100 synthetic indices, identifies the best market based on real-time digit statistics and patterns, and automatically switches active market to execute trade on it.");
      }
    };

    Blockly.Blocks['best_volatility_market'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Best Volatility Market (Symbol)");
        this.setOutput(true, "String");
        this.setColour("#ff9800");
        this.setTooltip("Returns the symbol of the currently chosen best Volatility market from the scanner.");
      }
    };

    Blockly.Blocks['rotate_volatility_market'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(TRADE_PARAMS_ICON, 16, 16, "*"))
            .appendField("Rotate to Next Volatility Market");
        this.appendDummyInput()
            .appendField("Condition:")
            .appendField(new Blockly.FieldDropdown([
              ["On Win (Shift Focus Across Synthetic Indices)", "on_win"],
              ["On Loss", "on_loss"],
              ["Always (Every Run)", "always"]
            ]), "CONDITION");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#ff9800");
        this.setTooltip("Rotates through Volatility markets (10 1s to 100) upon winning a trade or after every run.");
      }
    };

    Blockly.Blocks['check_digit_pattern_sequence'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Digit Sequence Pattern Match:")
            .appendField(new Blockly.FieldDropdown([
              ["Differs 9 → Under 9 → Under 8", "differs9_under9_under8"],
              ["Differs 0 → Over 0 → Over 1", "differs0_over0_over1"],
              ["3 Consecutive Even Digits", "even_even_even"],
              ["3 Consecutive Odd Digits", "odd_odd_odd"],
              ["Repeating Consecutive Digits", "repeat_digit"],
              ["Ascending Digits (D1 < D2 < D3)", "ascending"],
              ["Descending Digits (D1 > D2 > D3)", "descending"]
            ]), "PATTERN");
        this.setOutput(true, "Boolean");
        this.setColour("#9c27b0");
        this.setTooltip("Monitors the Last Digit of consecutive ticks. Returns true when the specific digit pattern sequence is matched.");
      }
    };

    Blockly.Blocks['set_entry_armed'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Set Entry Armed State to:")
            .appendField(new Blockly.FieldDropdown([
              ["TRUE (Armed to Purchase)", "TRUE"],
              ["FALSE (Disarmed)", "FALSE"]
            ]), "ARMED");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#4caf50");
        this.setTooltip("Sets the internal boolean Entry Armed state. Trigger contract purchase only when Entry Armed is TRUE.");
      }
    };

    Blockly.Blocks['is_entry_armed'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Is Entry Armed?");
        this.setOutput(true, "Boolean");
        this.setColour("#4caf50");
        this.setTooltip("Returns true if the internal Entry Armed state is active.");
      }
    };

    Blockly.Blocks['math_number_positive'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldNumber(0, 0), "NUM");
        this.setOutput(true, "Number");
        this.setColour("#1a1a1a");
      }
    };

    Blockly.Blocks['during_purchase'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(SELL_COND_ICON, 16, 16, "*"))
            .appendField("3. Sell conditions");
        this.appendStatementInput("DURING_PURCHASE_STACK").setCheck(null);
        this.setStyle('sell_conditions');
      }
    };

    Blockly.Blocks['check_sell'] = {
      init: function() {
        this.appendDummyInput().appendField("Sell is available");
        this.setOutput(true, "Boolean");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['sell_at_market'] = {
      init: function() {
        this.appendDummyInput().appendField("Sell at Market");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['get_payout'] = {
      init: function() {
        this.appendDummyInput().appendField("Get Payout");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['ticks'] = {
      init: function() {
        this.appendDummyInput().appendField("Ticks List");
        this.setOutput(true, "Array");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['last_tick'] = {
      init: function() {
        this.appendDummyInput().appendField("Last Tick");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['ohlc'] = {
      init: function() {
        this.appendDummyInput().appendField("OHLC List");
        this.setOutput(true, "Array");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['total_runs'] = {
      init: function() {
        this.appendDummyInput().appendField("Total Runs");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['total_win'] = {
      init: function() {
        this.appendDummyInput().appendField("Total Win");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['total_loss'] = {
      init: function() {
        this.appendDummyInput().appendField("Total Loss");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['main_account'] = {
      init: function() {
        this.appendDummyInput().appendField("Main Account");
        this.setOutput(true, "String");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['is_candle_black'] = {
      init: function() {
        this.appendDummyInput().appendField("Is Candle Black?");
        this.appendValueInput("OHLC").setCheck("Object").appendField("OHLC:");
        this.setOutput(true, "Boolean");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['read_ohlc'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Read OHLC:")
            .appendField(new Blockly.FieldDropdown([["Open", "open"], ["High", "high"], ["Low", "low"], ["Close", "close"]]), "OHLC_FIELD");
        this.appendValueInput("OHLC").setCheck("Object").appendField("OHLC:");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['get_ohlc'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Get OHLC from")
            .appendField(new Blockly.FieldDropdown([["Ticks", "ticks"], ["Candles", "candles"]]), "SOURCE")
            .appendField("at index");
        this.appendValueInput("INDEX").setCheck("Number");
        this.setOutput(true, "Object");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['check_direction'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Direction is")
            .appendField(new Blockly.FieldDropdown([["Rise", "rise"], ["Fall", "fall"], ["No Change", "no_change"]]), "DIRECTION");
        this.setOutput(true, "Boolean");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['direction'] = {
      init: function() {
        this.appendDummyInput().appendField("Direction");
        this.setOutput(true, "String");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['math_number_positive'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldNumber(0, 0), "NUM");
        this.setOutput(true, "Number");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['lists_create_with'] = {
      init: function() {
        const block = this;
        this.appendDummyInput()
            .appendField("set")
            .appendField(new Blockly.FieldVariable("list"), "VARIABLE")
            .appendField("to create list with")
            .appendField(new (Blockly as any).FieldImage(PLUS_ICON, 16, 16, "+", () => {
                 const newItem = block.workspace.newBlock('lists_statement');
                 if (newItem) {
                   newItem.initSvg();
                   newItem.render();
                   const connection = block.getInput('STACK').connection;
                   if (connection.targetConnection) {
                     let lastBlock = connection.targetBlock();
                     while (lastBlock.getNextBlock()) {
                       lastBlock = lastBlock.getNextBlock();
                     }
                     lastBlock.nextConnection.connect(newItem.previousConnection);
                   } else {
                     connection.connect(newItem.previousConnection);
                   }
                 }
            }));
        this.appendStatementInput("STACK")
            .setCheck("lists_statement");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['lists_statement'] = {
      init: function() {
        const block = this;
        this.appendValueInput("VALUE")
            .setCheck(null);
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(MINUS_ICON, 16, 16, "-", () => {
                 block.dispose(true);
            }));
        this.setInputsInline(true);
        this.setPreviousStatement(true, "lists_statement");
        this.setNextStatement(true, "lists_statement");
        this.setColour("#eeeeee");
      }
    };



    Blockly.Blocks['math_random_int'] = {
      init: function() {
        this.appendValueInput("FROM")
            .setCheck("Number")
            .appendField("random integer from");
        this.appendValueInput("TO")
            .setCheck("Number")
            .appendField("to");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(230);
      }
    };

    Blockly.Blocks['text_statement'] = {
      init: function() {
        this.appendValueInput("TEXT")
            .setCheck(null);
        this.setPreviousStatement(true, "text_statement");
        this.setNextStatement(true, "text_statement");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_print'] = {
      init: function() {
        this.appendValueInput("TEXT")
            .setCheck(null)
            .appendField("print");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_join'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("create text with")
            .appendField(new Blockly.FieldVariable("text"), "VARIABLE");
        this.appendStatementInput("STACK")
            .setCheck("text_statement");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['before_purchase'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(PURCHASE_COND_ICON, 16, 16, "*"))
            .appendField("2. Purchase conditions");
        this.appendStatementInput("BEFOREPURCHASE_STACK").setCheck(null);
        this.setStyle('purchase_conditions');
      }
    };

    Blockly.Blocks['after_purchase'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(RESTART_COND_ICON, 16, 16, "*"))
            .appendField("4. Restart trading conditions");
        this.appendStatementInput("AFTERPURCHASE_STACK").setCheck(null);
        this.setStyle('restart_trading');
      }
    };

    Blockly.Blocks['trade_definition_multiplier'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Multiplier:")
            .appendField(new Blockly.FieldDropdown([["10", "10"], ["20", "20"], ["40", "40"], ["100", "100"], ["200", "200"]]), "MULTIPLIERTYPE_LIST");
        this.appendDummyInput()
            .appendField("Currency:")
            .appendField(new Blockly.FieldDropdown([["USD", "USD"]]), "CURRENCY_LIST");
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("Stake:");
        this.appendDummyInput()
            .appendField("Limits:");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['multiplier_take_profit'] = {
      init: function() {
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("multiplier take profit");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['multiplier_stop_loss'] = {
      init: function() {
        this.appendValueInput("AMOUNT")
            .setCheck("Number")
            .appendField("multiplier stop loss");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['smaa_statement'] = {
      init: function() {
        this.appendDummyInput().appendField("SMA Array Indicator");
        this.appendDummyInput()
            .appendField("Variable:")
            .appendField(new Blockly.FieldVariable("smaa"), "VARIABLE");
        this.appendStatementInput("STATEMENT").setCheck(null).appendField("Input:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['bba_statement'] = {
      init: function() {
        this.appendDummyInput().appendField("BB Array Indicator");
        this.appendDummyInput()
            .appendField("Variable:")
            .appendField(new Blockly.FieldVariable("bba"), "VARIABLE");
        this.appendDummyInput()
            .appendField("Result:")
            .appendField(new Blockly.FieldDropdown([["Upper", "0"], ["Middle", "1"], ["Lower", "2"]]), "BBRESULT_LIST");
        this.appendStatementInput("STATEMENT").setCheck(null).appendField("Input:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['emaa_statement'] = {
      init: function() {
        this.appendDummyInput().appendField("EMA Array Indicator");
        this.appendDummyInput()
            .appendField("Variable:")
            .appendField(new Blockly.FieldVariable("emaa"), "VARIABLE");
        this.appendStatementInput("STATEMENT").setCheck(null).appendField("Input:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['rsia_statement'] = {
      init: function() {
        this.appendDummyInput().appendField("RSI Array Indicator");
        this.appendDummyInput()
            .appendField("Variable:")
            .appendField(new Blockly.FieldVariable("rsia"), "VARIABLE");
        this.appendStatementInput("STATEMENT").setCheck(null).appendField("Input:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['macda_statement'] = {
      init: function() {
        this.appendDummyInput().appendField("MACD Array Indicator");
        this.appendDummyInput()
            .appendField("Variable:")
            .appendField(new Blockly.FieldVariable("macda"), "VARIABLE");
        this.appendDummyInput()
            .appendField("Field:")
            .appendField(new Blockly.FieldDropdown([["MACD", "0"], ["Signal", "1"], ["Histogram", "2"]]), "MACDFIELDS_LIST");
        this.appendStatementInput("STATEMENT").setCheck(null).appendField("Input:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['std_dev_multiplier_up'] = {
      init: function() {
        this.appendValueInput("UPMULTIPLIER").setCheck("Number").appendField("Std Dev Multiplier Up:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['std_dev_multiplier_down'] = {
      init: function() {
        this.appendValueInput("DOWNMULTIPLIER").setCheck("Number").appendField("Std Dev Multiplier Down:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['fast_ema_period'] = {
      init: function() {
        this.appendValueInput("FAST_EMA_PERIOD").setCheck("Number").appendField("Fast EMA Period:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['slow_ema_period'] = {
      init: function() {
        this.appendValueInput("SLOW_EMA_PERIOD").setCheck("Number").appendField("Slow EMA Period:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['signal_ema_period'] = {
      init: function() {
        this.appendValueInput("SIGNAL_EMA_PERIOD").setCheck("Number").appendField("Signal EMA Period:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['stat'] = {
      init: function() {
        this.appendDummyInput().appendField("Stat");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['stat_list'] = {
      init: function() {
        this.appendDummyInput().appendField("Stat List");
        this.setOutput(true, "Array");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['lastDigitList'] = {
      init: function() {
        this.appendDummyInput().appendField("Last Digit List");
        this.setOutput(true, "Array");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['read_ohlc_obj'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Read OHLC Field:")
            .appendField(new Blockly.FieldDropdown([["Open", "open"], ["High", "high"], ["Low", "low"], ["Close", "close"], ["Epoch", "epoch"]]), "OHLCFIELD_LIST");
        this.appendValueInput("OHLCOBJ").setCheck(null).appendField("from OHLC Object:");
        this.setInputsInline(true);
        this.setOutput(true, null);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['ohlc_values_in_list'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("OHLC Values List:")
            .appendField(new Blockly.FieldDropdown([["Open", "open"], ["High", "high"], ["Low", "low"], ["Close", "close"], ["Epoch", "epoch"]]), "OHLCFIELD_LIST");
        this.appendValueInput("OHLCLIST").setCheck("Array").appendField("from OHLC List:");
        this.setInputsInline(true);
        this.setOutput(true, "Array");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['sell_price'] = {
      init: function() {
        this.appendDummyInput().appendField("Sell Price");
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['payout'] = {
      init: function() {
        this.appendDummyInput().appendField("Payout");
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['ask_price'] = {
      init: function() {
        this.appendDummyInput().appendField("Ask Price");
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['notify_telegram'] = {
      init: function() {
        this.appendDummyInput().appendField("Notify Telegram");
        this.appendValueInput("TELEGRAM_ACCESS_TOKEN").setCheck("String").appendField("Access Token:");
        this.appendValueInput("TELEGRAM_CHAT_ID").setCheck("String").appendField("Chat ID:");
        this.appendValueInput("TELEGRAM_MESSAGE").setCheck(null).appendField("Message:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#4caf50");
      }
    };

    Blockly.Blocks['epoch'] = {
      init: function() {
        this.appendDummyInput().appendField("Current Epoch");
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['tick_delay'] = {
      init: function() {
        this.appendValueInput("DELAY").setCheck("Number").appendField("Tick Delay:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['totimestamp'] = {
      init: function() {
        this.appendValueInput("DATETIME").setCheck("String").appendField("To Timestamp:");
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['todatetime'] = {
      init: function() {
        this.appendValueInput("TIMESTAMP").setCheck("Number").appendField("To Date/Time:");
        this.setOutput(true, "String");
        this.setColour(160);
      }
    };

    Blockly.Blocks['math_trig'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["sin", "SIN"], ["cos", "COS"], ["tan", "TAN"], ["asin", "ASIN"], ["acos", "ACOS"], ["atan", "ATAN"]]), "OP");
        this.appendValueInput("NUM").setCheck("Number");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(230);
      }
    };

    Blockly.Blocks['math_modulo'] = {
      init: function() {
        this.appendValueInput("DIVIDEND").setCheck("Number").appendField("remainder of");
        this.appendValueInput("DIVISOR").setCheck("Number").appendField("÷");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(230);
      }
    };

    Blockly.Blocks['math_constrain'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("Number").appendField("constrain");
        this.appendValueInput("LOW").setCheck("Number").appendField("low");
        this.appendValueInput("HIGH").setCheck("Number").appendField("high");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(230);
      }
    };

    Blockly.Blocks['text_append'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("append to")
            .appendField(new Blockly.FieldVariable("text"), "VAR");
        this.appendValueInput("TEXT").setCheck("String").appendField("text");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_length'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("String").appendField("length of");
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_isEmpty'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("String").appendField("is empty");
        this.setOutput(true, "Boolean");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_indexOf'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("String").appendField("in text");
        this.appendDummyInput()
            .appendField("find")
            .appendField(new Blockly.FieldDropdown([["first", "FIRST"], ["last", "LAST"]]), "END")
            .appendField("occurrence of");
        this.appendValueInput("FIND").setCheck("String");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_charAt'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("String").appendField("in text");
        this.appendDummyInput()
            .appendField("get letter #")
            .appendField(new Blockly.FieldDropdown([["from start", "FROM_START"], ["from end", "FROM_END"], ["first", "FIRST"], ["last", "LAST"], ["random", "RANDOM"]]), "WHERE");
        this.appendValueInput("AT").setCheck("Number");
        this.setInputsInline(true);
        this.setOutput(true, "String");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_getSubstring'] = {
      init: function() {
        this.appendValueInput("STRING").setCheck("String").appendField("in text");
        this.appendDummyInput()
            .appendField("get substring from")
            .appendField(new Blockly.FieldDropdown([["letter #", "FROM_START"], ["# from end", "FROM_END"], ["first", "FIRST"]]), "WHERE1");
        this.appendValueInput("AT1").setCheck("Number");
        this.appendDummyInput()
            .appendField("to")
            .appendField(new Blockly.FieldDropdown([["letter #", "FROM_START"], ["# from end", "FROM_END"], ["last", "LAST"]]), "WHERE2");
        this.appendValueInput("AT2").setCheck("Number");
        this.setInputsInline(true);
        this.setOutput(true, "String");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_changeCase'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("to")
            .appendField(new Blockly.FieldDropdown([["UPPER CASE", "UPPERCASE"], ["lower case", "LOWERCASE"], ["Title Case", "TITLECASE"]]), "CASE");
        this.appendValueInput("TEXT").setCheck("String");
        this.setInputsInline(true);
        this.setOutput(true, "String");
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_trim'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("trim spaces from")
            .appendField(new Blockly.FieldDropdown([["both sides", "BOTH"], ["left side", "LEFT"], ["right side", "RIGHT"]]), "MODE");
        this.appendValueInput("TEXT").setCheck("String");
        this.setInputsInline(true);
        this.setOutput(true, "String");
        this.setColour(160);
      }
    };

    Blockly.Blocks['lists_repeat'] = {
      init: function() {
        this.appendValueInput("ITEM").appendField("create list with item");
        this.appendValueInput("NUM").setCheck("Number").appendField("repeated");
        this.appendDummyInput().appendField("times");
        this.setInputsInline(true);
        this.setOutput(true, "Array");
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_isEmpty'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("Array").appendField("is empty");
        this.setOutput(true, "Boolean");
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_indexOf'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("Array").appendField("in list");
        this.appendDummyInput()
            .appendField("find")
            .appendField(new Blockly.FieldDropdown([["first", "FIRST"], ["last", "LAST"]]), "END")
            .appendField("occurrence of");
        this.appendValueInput("FIND");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_getSublist'] = {
      init: function() {
        this.appendValueInput("LIST").setCheck("Array").appendField("in list");
        this.appendDummyInput()
            .appendField("get sub-list from")
            .appendField(new Blockly.FieldDropdown([["#", "FROM_START"], ["# from end", "FROM_END"], ["first", "FIRST"]]), "WHERE1");
        this.appendValueInput("AT1").setCheck("Number");
        this.appendDummyInput()
            .appendField("to")
            .appendField(new Blockly.FieldDropdown([["#", "FROM_START"], ["# from end", "FROM_END"], ["last", "LAST"]]), "WHERE2");
        this.appendValueInput("AT2").setCheck("Number");
        this.setInputsInline(true);
        this.setOutput(true, "Array");
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_split'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["make list from text", "SPLIT"], ["make text from list", "JOIN"]]), "MODE");
        this.appendValueInput("INPUT").setCheck(null);
        this.appendValueInput("DELIM").setCheck("String").appendField("with delimiter");
        this.setInputsInline(true);
        this.setOutput(true, null);
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_sort'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("sort")
            .appendField(new Blockly.FieldDropdown([["numeric", "NUMERIC"], ["alphabetic", "ALPHABETIC"], ["alphabetic, ignore case", "IGNORE_CASE"]]), "TYPE")
            .appendField(new Blockly.FieldDropdown([["ascending", "1"], ["descending", "-1"]]), "ORDER");
        this.appendValueInput("LIST").setCheck("Array");
        this.setInputsInline(true);
        this.setOutput(true, "Array");
        this.setColour(260);
      }
    };

    Blockly.Blocks['controls_repeat'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("repeat")
            .appendField(new Blockly.FieldDropdown([["10", "10"], ["20", "20"], ["50", "50"], ["100", "100"]]), "TIMES")
            .appendField("times");
        this.appendStatementInput("DO").setCheck(null).appendField("do");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    };

    Blockly.Blocks['controls_repeat_ext'] = {
      init: function() {
        this.appendValueInput("TIMES").setCheck("Number").appendField("repeat");
        this.appendDummyInput().appendField("times");
        this.appendStatementInput("DO").setCheck(null).appendField("do");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    };

    Blockly.Blocks['block_holder'] = {
      init: function() {
        this.appendDummyInput().appendField("Block Holder");
        this.appendStatementInput("STACK").setCheck(null);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['console'] = {
      init: function() {
        this.appendValueInput("MESSAGE").setCheck(null).appendField("Log to Console:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#4caf50");
      }
    };

    Blockly.Blocks['trade_again'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Trade again");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['stop_bot'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Stop bot");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('restart_trading');
      }
    };

    Blockly.Blocks['contract_check_result'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Check Contract Result")
            .appendField(new Blockly.FieldDropdown([["Win", "win"], ["Loss", "loss"], ["Stalled", "stalled"]]), "CHECK_RESULT");
        this.setOutput(true, "Boolean");
        this.setColour(200);
      }
    };

    Blockly.Blocks['is_purchasing'] = {
      init: function() {
        this.appendDummyInput().appendField("Is Purchasing");
        this.setOutput(true, "Boolean");
        this.setColour(200);
      }
    };

    Blockly.Blocks['is_closed'] = {
      init: function() {
        this.appendDummyInput().appendField("Is Closed (from broker)");
        this.setOutput(true, "Boolean");
        this.setColour(200);
      }
    };

    Blockly.Blocks['consecutive_loss_count'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Consecutive Loss Count");
        this.setOutput(true, "Number");
        this.setColour(200);
      }
    };

    Blockly.Blocks['notify'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Notify")
            .appendField(new Blockly.FieldDropdown([["Success", "success"], ["Warning", "warn"], ["Info", "info"], ["Error", "error"]]), "NOTIFICATION_TYPE")
            .appendField("sound")
            .appendField(new Blockly.FieldDropdown([["Silent", "silent"], ["Announcement", "announcement"], ["Win", "win"], ["Loss", "loss"], ["Earned", "earned"]]), "NOTIFICATION_SOUND");
        this.appendValueInput("MESSAGE").setCheck(null).appendField("Message:");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#4caf50");
      }
    };

    Blockly.Blocks['set_prediction_single'] = {
      init: function() {
        this.appendValueInput("PREDICTION")
            .setCheck("Number")
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Set Prediction:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['digit_signal_pattern'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Digit Signal Pattern");
        this.setOutput(true, "Number");
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['digit_pattern'] = {
      init: function() {
        this.appendValueInput("SIGNAL")
            .setCheck("Number")
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Digit Pattern (Signal):");
        this.setOutput(true, "Number");
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['read_details'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Read Detail:")
            .appendField(new Blockly.FieldDropdown([
              ["Purchase Price", "purchase_price"],
              ["Payout", "payout"],
              ["Profit", "profit"],
              ["Contract Type", "contract_type"],
              ["Entry Spot", "entry_tick"],
              ["Exit Spot", "exit_tick"],
              ["Barrier", "barrier"],
              ["Result", "result"]
            ]), "DETAIL_INDEX");
        this.setOutput(true, null);
        this.setColour(160);
        this.setTooltip("Read specific details from the last contract");
      }
    };

    delete (Blockly.Blocks as any)['purchase'];
    Blockly.Blocks['purchase'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Purchase")
            .appendField(new Blockly.FieldDropdown(function() {
              const block = (this as any).getSourceBlock ? (this as any).getSourceBlock() : null;
              const ws = block?.workspace;
              let tradeType = '';
              let tradeCat = '';
              if (ws) {
                const ttBlock = ws.getAllBlocks(false).find((b: any) => b.type === 'trade_definition_tradetype');
                if (ttBlock) {
                  tradeType = ttBlock.getFieldValue('TRADETYPE_LIST') || '';
                  tradeCat = ttBlock.getFieldValue('TRADETYPECAT_LIST') || '';
                }
              }
              if (tradeType === 'higherlower' || tradeCat === 'higherlower') {
                return [
                  ["Higher", "HIGHER"],
                  ["Lower", "LOWER"]
                ];
              }
              return [
                ["Rise", "RISE"],
                ["Fall", "FALL"],
                ["Higher", "HIGHER"],
                ["Lower", "LOWER"],
                ["Differs", "DIGITDIFF"],
                ["Matches", "DIGITMATCH"],
                ["Over", "DIGITOVER"],
                ["Under", "DIGITUNDER"],
                ["Only Ups", "RUNHIGH"],
                ["Only Downs", "RUNLOW"],
                ["Buy", "ACCU"],
                ["Even", "DIGITEVEN"],
                ["Odd", "DIGITODD"]
              ];
            }), "PURCHASE_LIST");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('purchase_conditions');
      }
    };

    Blockly.Blocks['set_prediction'] = {
      init: function() {
        this.appendValueInput("PREDICTION")
            .setCheck("Number")
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Set Prediction 1:");
        this.appendValueInput("PREDICTION2")
            .setCheck("Number")
            .appendField("Prediction 2 (Dual):");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['set_barrier_offset'] = {
      init: function() {
        this.appendValueInput("BARRIER")
            .setCheck(["Number", "String"])
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Set Barrier Offset:");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
              ["Offset +", "offset_plus"],
              ["Offset -", "offset_minus"],
              ["Absolute", "absolute"]
            ]), "BARRIER_TYPE");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['purchase_dual'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Purchase Dual")
            .appendField(new Blockly.FieldDropdown([
              ["Digit Over", "DIGITOVER"],
              ["Digit Under", "DIGITUNDER"],
              ["Rise", "RISE"], 
              ["Fall", "FALL"],
              ["Higher", "HIGHER"],
              ["Lower", "LOWER"],
              ["Only Ups", "RUNHIGH"],
              ["Only Downs", "RUNLOW"],
              ["Digit Even", "DIGITEVEN"],
              ["Digit Odd", "DIGITODD"],
              ["Digit Match", "DIGITMATCH"],
              ["Digit Differ", "DIGITDIFF"],
              ["Touch", "ONETOUCH"],
              ["No Touch", "NOTOUCH"]
            ]), "TYPE1")
            .appendField("and")
            .appendField(new Blockly.FieldDropdown([
              ["Digit Under", "DIGITUNDER"],
              ["Digit Over", "DIGITOVER"],
              ["Rise", "RISE"], 
              ["Fall", "FALL"],
              ["Higher", "HIGHER"],
              ["Lower", "LOWER"],
              ["Only Ups", "RUNHIGH"],
              ["Only Downs", "RUNLOW"],
              ["Digit Even", "DIGITEVEN"],
              ["Digit Odd", "DIGITODD"],
              ["Digit Match", "DIGITMATCH"],
              ["Digit Differ", "DIGITDIFF"],
              ["Touch", "ONETOUCH"],
              ["No Touch", "NOTOUCH"]
            ]), "TYPE2");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('purchase_conditions');
      }
    };

    Blockly.Blocks['purchase_over_under_dual'] = {
      init: function() {
        this.appendValueInput("OVER_BARRIER")
            .setCheck("Number")
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Purchase Dual: Digit Over (Barrier:");
        this.appendValueInput("UNDER_BARRIER")
            .setCheck("Number")
            .appendField(") and Digit Under (Barrier:");
        this.appendDummyInput()
            .appendField(")");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('purchase_conditions');
      }
    };

    Blockly.Blocks['purchase_dual_with_barriers'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Purchase Dual")
            .appendField(new Blockly.FieldDropdown([
              ["Digit Over", "DIGITOVER"],
              ["Digit Under", "DIGITUNDER"],
              ["Rise", "RISE"], 
              ["Fall", "FALL"],
              ["Digit Match", "DIGITMATCH"],
              ["Digit Differ", "DIGITDIFF"],
              ["Higher", "HIGHER"],
              ["Lower", "LOWER"],
              ["Digit Even", "DIGITEVEN"],
              ["Digit Odd", "DIGITODD"],
              ["Only Ups", "RUNHIGH"],
              ["Only Downs", "RUNLOW"]
            ]), "TYPE1");
        this.appendValueInput("BARRIER1")
            .setCheck("Number")
            .appendField("Barrier 1:");
        this.appendDummyInput()
            .appendField("and")
            .appendField(new Blockly.FieldDropdown([
              ["Digit Under", "DIGITUNDER"],
              ["Digit Over", "DIGITOVER"],
              ["Rise", "RISE"], 
              ["Fall", "FALL"],
              ["Digit Match", "DIGITMATCH"],
              ["Digit Differ", "DIGITDIFF"],
              ["Digit Even", "DIGITEVEN"],
              ["Digit Odd", "DIGITODD"],
              ["Only Ups", "RUNHIGH"],
              ["Only Downs", "RUNLOW"]
            ]), "TYPE2");
        this.appendValueInput("BARRIER2")
            .setCheck("Number")
            .appendField("Barrier 2:");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('purchase_conditions');
      }
    };

    Blockly.Blocks['tick_analysis'] = {
      init: function() {
        this.appendDummyInput().appendField("Tick Analysis");
        this.appendStatementInput("TICKANALYSIS_STACK").setCheck(null).appendField("Actions:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['consecutive_digits'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Consecutive Digit (Count:")
            .appendField(new (Blockly as any).FieldNumber(3, 1, 10), "COUNT")
            .appendField(")");
        this.setOutput(true, "Number");
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['last_digit'] = {
      init: function() {
        this.appendDummyInput().appendField("Last Digit");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['last_digit_pattern'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new (Blockly as any).FieldImage(OTIVO_LOGO_WHITE, 16, 16, "*"))
            .appendField("Last 3 Digits Pattern");
        this.setOutput(true, "String");
        this.setColour("#3f51b5");
      }
    };

    Blockly.Blocks['least_digit'] = {
      init: function() {
        this.appendDummyInput().appendField("Least Digit");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['least_frequent_digit'] = {
      init: function() {
        this.appendDummyInput().appendField("Least Frequent Digit");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['most_frequent_digit'] = {
      init: function() {
        this.appendDummyInput().appendField("Most Frequent Digit");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['rise_fall_signal'] = {
      init: function() {
        this.appendDummyInput().appendField("Rise/Fall Signal");
        this.setOutput(true, "String");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['even_odd_signal'] = {
      init: function() {
        this.appendDummyInput().appendField("Even/Odd Signal");
        this.setOutput(true, "String");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['over_under_signal'] = {
      init: function() {
        this.appendDummyInput().appendField("Over/Under Signal (Direction Summary)");
        this.setOutput(true, "String");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['differ_signal'] = {
      init: function() {
        this.appendDummyInput().appendField("Differ Signal (2, 3 & 5. Missing & Overdue Gaps)");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['accumulator_signal'] = {
      init: function() {
        this.appendDummyInput().appendField("Accumulator Signal (50/50 % Neutral Trigger)");
        this.setOutput(true, "String");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['accu_noise_calm_buy'] = {
      init: function() {
        this.appendDummyInput().appendField("ACCU NOISE — CALM BUY");
        this.setOutput(true, "String");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['match_signal'] = {
      init: function() {
        this.appendDummyInput().appendField("Match Signal (Prediction)");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['balance'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Balance:")
            .appendField(new Blockly.FieldDropdown([["String", "STR"], ["Number", "NUM"]]), "BALANCE_TYPE");
        this.setOutput(true, null);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['total_profit'] = {
      init: function() {
        this.appendDummyInput().appendField("Total Profit/Loss");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['rsi_statement'] = {
      init: function() {
        this.appendDummyInput().appendField("RSI Indicator");
        this.appendDummyInput()
            .appendField("Variable:")
            .appendField(new Blockly.FieldVariable("rsi"), "VARIABLE");
        this.appendStatementInput("STATEMENT").setCheck(null).appendField("Input:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['input_list'] = {
      init: function() {
        this.appendValueInput("INPUT_LIST").setCheck("Array").appendField("Input List:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['period'] = {
      init: function() {
        this.appendValueInput("PERIOD").setCheck("Number").appendField("Period:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['tick'] = {
      init: function() {
        this.appendDummyInput().appendField("Current Tick");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['lists_create_with'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Create List with Variable:")
            .appendField(new Blockly.FieldVariable("list"), "VARIABLE");
        this.appendStatementInput("STACK").setCheck(null).appendField("Items:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(260);
      }
    };

    Blockly.Blocks['text_join'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Join Text with Variable:")
            .appendField(new Blockly.FieldVariable("text"), "VARIABLE");
        this.appendStatementInput("STACK").setCheck(null).appendField("Items:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['lists_statement'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck(null).appendField("Item:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_getIndex'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("Array").appendField("in list");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["get", "GET"], ["get and remove", "GET_REMOVE"], ["remove", "REMOVE"]]), "MODE")
            .appendField(new Blockly.FieldDropdown([["from start", "FROM_START"], ["from end", "FROM_END"], ["first", "FIRST"], ["last", "LAST"], ["random", "RANDOM"]]), "WHERE");
        this.setOutput(true);
        this.setColour(260);
        this.setInputsInline(true);
        this.updateShape_(false, true);
      },
      onchange: function() {
        if (!this.workspace) return;
        const mode = this.getFieldValue('MODE');
        const where = this.getFieldValue('WHERE');
        const isAt = (where === 'FROM_START' || where === 'FROM_END');
        const isStatement = (mode === 'REMOVE');
        this.updateShape_(isStatement, isAt);
      },
      mutationToDom: function() {
        const container = Blockly.utils.xml.createElement('mutation');
        const isStatement = !this.outputConnection;
        container.setAttribute('statement', isStatement.toString());
        const isAt = !!this.getInput('AT');
        container.setAttribute('at', isAt.toString());
        return container;
      },
      domToMutation: function(xmlElement: Element) {
        const isStatement = xmlElement.getAttribute('statement') === 'true';
        const isAt = xmlElement.getAttribute('at') !== 'false';
        this.updateShape_(isStatement, isAt);
      },
      updateShape_: function(isStatement: boolean, isAt: boolean) {
        if (isAt) {
          if (!this.getInput('AT')) {
            this.appendValueInput('AT').setCheck('Number');
          }
        } else {
          if (this.getInput('AT')) {
            this.removeInput('AT');
          }
        }
        
        if (isStatement) {
          this.setOutput(false);
          this.setPreviousStatement(true);
          this.setNextStatement(true);
        } else {
          this.setOutput(true);
          this.setPreviousStatement(false);
          this.setNextStatement(false);
        }
      }
    };

    Blockly.Blocks['lists_setIndex'] = {
      init: function() {
        this.appendValueInput("LIST").setCheck("Array").appendField("in list");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["set", "SET"], ["insert at", "INSERT"]]), "MODE")
            .appendField(new Blockly.FieldDropdown([["from start", "FROM_START"], ["from end", "FROM_END"], ["first", "FIRST"], ["last", "LAST"], ["random", "RANDOM"]]), "WHERE");
        this.appendValueInput("TO").appendField("as");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(260);
        this.setInputsInline(true);
        this.updateShape_(true);
      },
      onchange: function() {
        if (!this.workspace) return;
        const where = this.getFieldValue('WHERE');
        const isAt = (where === 'FROM_START' || where === 'FROM_END');
        this.updateShape_(isAt);
      },
      mutationToDom: function() {
        const container = Blockly.utils.xml.createElement('mutation');
        const isAt = !!this.getInput('AT');
        container.setAttribute('at', isAt.toString());
        return container;
      },
      domToMutation: function(xmlElement: Element) {
        const isAt = xmlElement.getAttribute('at') !== 'false';
        this.updateShape_(isAt);
      },
      updateShape_: function(isAt: boolean) {
        if (isAt) {
          if (!this.getInput('AT')) {
            this.appendValueInput('AT').setCheck('Number');
            this.moveInputBefore('AT', 'TO');
          }
        } else {
          if (this.getInput('AT')) {
            this.removeInput('AT');
          }
        }
      }
    };

    Blockly.Blocks['lists_length'] = {
      init: function() {
        this.appendValueInput("VALUE").setCheck("Array").appendField("length of");
        this.setOutput(true, "Number");
        this.setColour(260);
      }
    };

    Blockly.Blocks['lists_create_empty'] = {
      init: function() {
        this.appendDummyInput().appendField("create empty list");
        this.setOutput(true, "Array");
        this.setColour(260);
      }
    };

    Blockly.Blocks['math_constant'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["\u03c0", "PI"], ["e", "E"], ["\u03c6", "GOLDEN_RATIO"], ["sqrt(2)", "SQRT2"], ["sqrt(\u00bd)", "SQRT1_2"], ["\u221e", "INFINITY"]]), "CONSTANT");
        this.setOutput(true, "Number");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['math_random_float'] = {
      init: function() {
        this.appendDummyInput().appendField("random fraction");
        this.setOutput(true, "Number");
        this.setColour(230);
      }
    };

    Blockly.Blocks['text_statement'] = {
      init: function() {
        this.appendValueInput("TEXT").setCheck(null).appendField("Text:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['virtual_trade_manager'] = {
      init: function() {
        const block = this;
        const makeTypeDropdown = (countFieldName: string) => {
          return new Blockly.FieldDropdown(function(this: any) {
            const rawCount = this.sourceBlock_ ? Number(this.sourceBlock_.getFieldValue(countFieldName)) : 2;
            const isSingular = rawCount === 1;
            return isSingular
              ? [["Loss", "loss"], ["Win", "win"]]
              : [["Losses", "loss"], ["Wins", "win"]];
          });
        };

        const makeCountField = (defaultVal: number, typeFieldName: string) => {
          return new (Blockly as any).FieldNumber(defaultVal, 0, 100, 1, function(this: any, newVal: number) {
            if (this.sourceBlock_) {
              setTimeout(() => {
                const typeField = this.sourceBlock_?.getField(typeFieldName);
                if (typeField) {
                  const curVal = typeField.getValue();
                  typeField.getOptions(false);
                  typeField.setValue(curVal);
                  if (typeof (typeField as any).forceRerender === 'function') {
                    (typeField as any).forceRerender();
                  }
                }
                if (this.sourceBlock_?.rendered) {
                  this.sourceBlock_.render();
                }
              }, 0);
            }
            return newVal;
          });
        };

        this.appendDummyInput("HEADER")
            .appendField("Virtual Trade Manager")
            .appendField("Sequence Switch:")
            .appendField(new Blockly.FieldDropdown([["OFF", "OFF"], ["ON", "ON"]], function(this: any, newVal: string) {
              if (this.sourceBlock_ && typeof this.sourceBlock_.updateShape_ === 'function') {
                const isCont = this.sourceBlock_.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
                const isTickLoss = this.sourceBlock_.getFieldValue('TICK_LOSS_SWITCH') === 'ON';
                if (newVal === 'ON' && isTickLoss) {
                  this.sourceBlock_.setFieldValue('OFF', 'TICK_LOSS_SWITCH');
                }
                this.sourceBlock_.updateShape_(newVal === 'ON', isCont, newVal === 'ON' ? false : isTickLoss);
              }
              return newVal;
            }), "SEQUENCE_SWITCH");

        this.appendDummyInput("CONTINUOUS_ROW")
            .appendField("Trading continues until TP/SL after signal:")
            .appendField(new Blockly.FieldDropdown([["OFF", "OFF"], ["ON", "ON"]], function(this: any, newVal: string) {
              if (this.sourceBlock_ && typeof this.sourceBlock_.updateShape_ === 'function') {
                const isSeq = this.sourceBlock_.getFieldValue('SEQUENCE_SWITCH') === 'ON';
                const isTickLoss = this.sourceBlock_.getFieldValue('TICK_LOSS_SWITCH') === 'ON';
                this.sourceBlock_.updateShape_(isSeq, newVal === 'ON', isTickLoss);
              }
              return newVal;
            }), "CONTINUOUS_SWITCH");

        this.appendDummyInput("TICK_LOSS_ROW")
            .appendField("Counted losses under ticks switch:")
            .appendField(new Blockly.FieldDropdown([["OFF", "OFF"], ["ON", "ON"]], function(this: any, newVal: string) {
              if (this.sourceBlock_ && typeof this.sourceBlock_.updateShape_ === 'function') {
                const isSeq = this.sourceBlock_.getFieldValue('SEQUENCE_SWITCH') === 'ON';
                const isCont = this.sourceBlock_.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
                if (newVal === 'ON' && isSeq) {
                  this.sourceBlock_.setFieldValue('OFF', 'SEQUENCE_SWITCH');
                }
                this.sourceBlock_.updateShape_(newVal === 'ON' ? false : isSeq, isCont, newVal === 'ON');
              }
              return newVal;
            }), "TICK_LOSS_SWITCH");

        this.appendValueInput("VIRTUAL_LOSSES")
            .setCheck("Number")
            .appendField("Virtual losses threshold:");
        this.appendValueInput("REAL_TRADES")
            .setCheck("Number")
            .appendField("Real trades count:");
        this.appendValueInput("LOSSES_AFTER_REAL_LOSS")
            .setCheck("Number")
            .appendField("Virtual losses after real loss:");

        const type1Dropdown = makeTypeDropdown("SEQ_1_COUNT");
        const type2Dropdown = makeTypeDropdown("SEQ_2_COUNT");
        const type3Dropdown = makeTypeDropdown("SEQ_3_COUNT");

        this.appendDummyInput("SEQ_ROW_1")
            .appendField("1st:")
            .appendField(makeCountField(2, "SEQ_1_TYPE"), "SEQ_1_COUNT")
            .appendField(type1Dropdown, "SEQ_1_TYPE");
        this.appendDummyInput("SEQ_ROW_2")
            .appendField("2nd:")
            .appendField(makeCountField(1, "SEQ_2_TYPE"), "SEQ_2_COUNT")
            .appendField(type2Dropdown, "SEQ_2_TYPE");
        this.appendDummyInput("SEQ_ROW_3")
            .appendField("3rd:")
            .appendField(makeCountField(1, "SEQ_3_TYPE"), "SEQ_3_COUNT")
            .appendField(type3Dropdown, "SEQ_3_TYPE");

        this.appendDummyInput("TICK_LOSS_ROW_1")
            .appendField("Counted losses:")
            .appendField(new (Blockly as any).FieldNumber(3, 1, 1000, 1), "TICK_LOSS_COUNT");
        this.appendDummyInput("TICK_LOSS_ROW_2")
            .appendField("Under how many ticks:")
            .appendField(new (Blockly as any).FieldNumber(10, 1, 10000, 1), "TICK_LOSS_WINDOW");
        this.appendDummyInput("TICK_LOSS_ROW_3")
            .appendField("Then last virtual trade:")
            .appendField(new Blockly.FieldDropdown([["Loss", "loss"], ["Win", "win"]]), "TICK_LAST_RESULT");

        this.setFieldValue("loss", "SEQ_1_TYPE");
        this.setFieldValue("win", "SEQ_2_TYPE");
        this.setFieldValue("loss", "SEQ_3_TYPE");
        this.setFieldValue("OFF", "CONTINUOUS_SWITCH");
        this.setFieldValue("OFF", "TICK_LOSS_SWITCH");
        this.setFieldValue("loss", "TICK_LAST_RESULT");

        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(230);
        this.setTooltip("Automatically switches between virtual and real trading based on losses, sequences, or counted losses under ticks. When 'Trading continues until TP/SL after signal' is ON, once the virtual signal is found, the bot will continue to trade on REAL until Take Profit or Stop Loss is reached.");
        this.updateShape_(false, false, false);
      },
      mutationToDom: function() {
        const container = Blockly.utils.xml.createElement('mutation');
        const isSequenceOn = this.getFieldValue('SEQUENCE_SWITCH') === 'ON';
        const isContinuousOn = this.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
        const isTickLossOn = this.getFieldValue('TICK_LOSS_SWITCH') === 'ON';
        container.setAttribute('sequence_mode', isSequenceOn ? 'true' : 'false');
        container.setAttribute('continuous_mode', isContinuousOn ? 'true' : 'false');
        container.setAttribute('tick_loss_mode', isTickLossOn ? 'true' : 'false');
        return container;
      },
      domToMutation: function(xmlElement: Element) {
        const isSequenceOn = xmlElement.getAttribute('sequence_mode') === 'true' || this.getFieldValue('SEQUENCE_SWITCH') === 'ON';
        const isContinuousOn = xmlElement.getAttribute('continuous_mode') === 'true' || this.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
        const isTickLossOn = xmlElement.getAttribute('tick_loss_mode') === 'true' || this.getFieldValue('TICK_LOSS_SWITCH') === 'ON';
        this.updateShape_(isSequenceOn, isContinuousOn, isTickLossOn);
      },
      onchange: function(event: any) {
        if (!this.workspace || this.workspace.isDragging()) return;
        if (
          event.type === Blockly.Events.FINISHED_LOADING ||
          event.type === Blockly.Events.BLOCK_CREATE ||
          (event.type === Blockly.Events.BLOCK_CHANGE && event.blockId === this.id)
        ) {
          const isSequenceOn = this.getFieldValue('SEQUENCE_SWITCH') === 'ON';
          const isContinuousOn = this.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
          const isTickLossOn = this.getFieldValue('TICK_LOSS_SWITCH') === 'ON';
          this.updateShape_(isSequenceOn, isContinuousOn, isTickLossOn);
        }
      },
      updateShape_: function(isSequenceOn?: boolean, isContinuousOn?: boolean, isTickLossOn?: boolean) {
        if (typeof isSequenceOn !== 'boolean') {
          isSequenceOn = this.getFieldValue('SEQUENCE_SWITCH') === 'ON';
        }
        if (typeof isContinuousOn !== 'boolean') {
          isContinuousOn = this.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
        }
        if (typeof isTickLossOn !== 'boolean') {
          isTickLossOn = this.getFieldValue('TICK_LOSS_SWITCH') === 'ON';
        }

        const setInputVisibility = (inputName: string, visible: boolean) => {
          const input = this.getInput(inputName);
          if (input) {
            input.setVisible(visible);
            const targetBlock = input.connection?.targetBlock();
            if (targetBlock) {
              if (typeof (targetBlock as any).setVisible === 'function') {
                (targetBlock as any).setVisible(visible);
              }
              const svgRoot = typeof (targetBlock as any).getSvgRoot === 'function' ? (targetBlock as any).getSvgRoot() : null;
              if (svgRoot) {
                svgRoot.style.display = visible ? '' : 'none';
              }
            }
          }
        };

        setInputVisibility('VIRTUAL_LOSSES', !isSequenceOn && !isTickLossOn);
        setInputVisibility('REAL_TRADES', !isContinuousOn);
        setInputVisibility('LOSSES_AFTER_REAL_LOSS', !isContinuousOn && !isSequenceOn && !isTickLossOn);

        const seqInputs = ['SEQ_ROW_1', 'SEQ_ROW_2', 'SEQ_ROW_3'];
        seqInputs.forEach((seqName) => {
          setInputVisibility(seqName, isSequenceOn);
        });

        const tickLossInputs = ['TICK_LOSS_ROW_1', 'TICK_LOSS_ROW_2', 'TICK_LOSS_ROW_3'];
        tickLossInputs.forEach((name) => {
          setInputVisibility(name, isTickLossOn);
        });

        if (this.rendered) {
          this.render();
        }
      }
    };

    Blockly.Blocks['auto_stake'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Auto Stake");
        this.appendValueInput("MARTINGALE")
            .setCheck("Number")
            .appendField("Martingale Factor:");
        this.appendValueInput("FALLBACK")
            .setCheck("Number")
            .appendField("Fallback / Min Stake:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(230);
        this.setTooltip("Automatically calculates base stake based on current balance and Martingale factor. Restores stake after a win, and multiplies by Martingale factor on a loss.");
      }
    };

    Blockly.Blocks['text_print'] = {
      init: function() {
        this.appendValueInput("TEXT").setCheck(null).appendField("Print:");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(160);
      }
    };

    Blockly.Blocks['text_prompt_ext'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Prompt for")
            .appendField(new Blockly.FieldDropdown([["Text", "TEXT"], ["Number", "NUMBER"]]), "TYPE");
        this.appendValueInput("TEXT").setCheck("String").appendField("Message:");
        this.setOutput(true, null);
        this.setColour(160);
      }
    };

    Blockly.Blocks['math_random_int'] = {
      init: function() {
        this.appendValueInput("FROM").setCheck("Number").appendField("random integer from");
        this.appendValueInput("TO").setCheck("Number").appendField("to");
        this.setOutput(true, "Number");
        this.setColour("#eeeeee");
        this.setInputsInline(true);
      }
    };

    Blockly.Blocks['math_round'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
              ["round", "ROUND"], ["round up", "ROUNDUP"], ["round down", "ROUNDDOWN"]
            ]), "OP");
        this.appendValueInput("NUM").setCheck("Number");
        this.setOutput(true, "Number");
        this.setColour("#eeeeee");
        this.setInputsInline(true);
      }
    };

    Blockly.Blocks['math_number_property'] = {
      init: function() {
        this.appendValueInput("NUMBER_TO_CHECK").setCheck("Number");
        this.appendDummyInput()
            .appendField("is")
            .appendField(new Blockly.FieldDropdown([
              ["Even", "EVEN"], ["Odd", "ODD"], ["Prime", "PRIME"], ["Whole", "WHOLE"],
              ["Positive", "POSITIVE"], ["Negative", "NEGATIVE"], ["Divisible By", "DIVISIBLE_BY"]
            ]), "PROPERTY");
        this.setOutput(true, "Boolean");
        this.setColour(230);
      }
    };

    Blockly.Blocks['math_single'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
              ["square root", "ROOT"], ["absolute", "ABS"], ["negate", "NEG"],
              ["natural log", "LN"], ["log 10", "LOG10"], ["exp", "EXP"], ["10^", "POW10"]
            ]), "OP");
        this.appendValueInput("NUM").setCheck(null);
        this.setOutput(true, ["Number", "Boolean"]);
        this.setColour("#eeeeee");
        this.setInputsInline(true);
      }
    };

    Blockly.Blocks['logic_ternary'] = {
      init: function() {
        this.appendValueInput("IF").setCheck("Boolean").appendField("test");
        this.appendValueInput("THEN").setCheck(null).appendField("if true");
        this.appendValueInput("ELSE").setCheck(null).appendField("if false");
        this.setOutput(true, null);
        this.setColour("#eeeeee");
        this.setInputsInline(true);
      }
    };

    Blockly.Blocks['math_change'] = {
      init: function() {
        this.appendValueInput("DELTA")
            .setCheck("Number")
            .appendField("Change")
            .appendField(new Blockly.FieldVariable("item"), "VAR")
            .appendField("by");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(230);
      }
    };

    Blockly.Blocks['logic_boolean'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["true", "TRUE"], ["false", "FALSE"]]), "BOOL");
        this.setOutput(true, "Boolean");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['variables_set'] = {
      init: function() {
        this.appendValueInput("VALUE")
            .appendField("Set")
            .appendField(new Blockly.FieldVariable("item"), "VAR")
            .appendField("to");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(330);
      }
    };

    Blockly.Blocks['variables_get'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldVariable("item"), "VAR");
        this.setOutput(true, null);
        this.setColour(330);
      }
    };

    Blockly.Blocks['math_number'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldNumber(0), "NUM");
        this.setOutput(true, "Number");
        this.setColour("#1a1a1a");
      }
    };

    Blockly.Blocks['text'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldTextInput(""), "TEXT");
        this.setOutput(true, "String");
        this.setColour(160);
      }
    };

    Blockly.Blocks['logic_compare'] = {
      init: function() {
        this.appendValueInput("A");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["=", "EQ"], ["\u2260", "NEQ"], ["<", "LT"], ["\u2264", "LTE"], [">", "GT"], ["\u2265", "GTE"]]), "OP");
        this.appendValueInput("B");
        this.setInputsInline(true);
        this.setOutput(true, "Boolean");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['math_on_list'] = {
      init: function() {
        this.appendValueInput("LIST").setCheck("Array").appendField(new Blockly.FieldDropdown([["sum", "SUM"], ["min", "MIN"], ["max", "MAX"], ["average", "AVERAGE"], ["median", "MEDIAN"], ["mode", "MODE"], ["standard deviation", "STD_DEV"], ["random item", "RANDOM"]]), "OP").appendField("of list");
        this.setOutput(true, "Number");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['math_arithmetic'] = {
      init: function() {
        this.appendValueInput("A").setCheck("Number");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["+", "ADD"], ["-", "MINUS"], ["*", "MULTIPLY"], ["/", "DIVIDE"], ["^", "POWER"]]), "OP");
        this.appendValueInput("B").setCheck("Number");
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['logic_null'] = {
      init: function() {
        this.appendDummyInput().appendField("null");
        this.setOutput(true, null);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['logic_negate'] = {
      init: function() {
        this.appendValueInput("BOOL").setCheck("Boolean").appendField("not");
        this.setOutput(true, "Boolean");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['logic_operation'] = {
      init: function() {
        this.appendValueInput("A").setCheck("Boolean");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["and", "AND"], ["or", "OR"]]), "OP");
        this.appendValueInput("B").setCheck("Boolean");
        this.setInputsInline(true);
        this.setOutput(true, "Boolean");
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['controls_whileUntil'] = {
      init: function() {
        this.appendValueInput("BOOL").setCheck("Boolean").appendField("repeat");
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["while", "WHILE"], ["until", "UNTIL"]]), "MODE");
        this.appendStatementInput("DO").appendField("do");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    };

    Blockly.Blocks['controls_for'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("count with")
            .appendField(new Blockly.FieldVariable("i"), "VAR")
            .appendField("from");
        this.appendValueInput("FROM").setCheck("Number");
        this.appendValueInput("TO").setCheck("Number").appendField("to");
        this.appendValueInput("BY").setCheck("Number").appendField("by");
        this.appendStatementInput("DO").appendField("do");
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    };

    Blockly.Blocks['controls_forEach'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("for each item")
            .appendField(new Blockly.FieldVariable("j"), "VAR")
            .appendField("in list");
        this.appendValueInput("LIST").setCheck("Array");
        this.appendStatementInput("DO").appendField("do");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    };

    Blockly.Blocks['controls_flow_statements'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([["break out of loop", "BREAK"], ["continue with next iteration", "CONTINUE"]]), "FLOW");
        this.setPreviousStatement(true);
        this.setColour(120);
      }
    };

    // Advanced procedure blocks are registered via registerProcedureBlocks(Blockly)

    Blockly.Blocks['sma'] = {
      init: function() {
        this.appendValueInput("INPUT").setCheck("Array").appendField("SMA Input:");
        this.appendValueInput("PERIOD").setCheck("Number").appendField("Period:");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['ema'] = {
      init: function() {
        this.appendValueInput("INPUT").setCheck("Array").appendField("EMA Input:");
        this.appendValueInput("PERIOD").setCheck("Number").appendField("Period:");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['bb'] = {
      init: function() {
        this.appendValueInput("INPUT").setCheck("Array").appendField("Bollinger Bands Input:");
        this.appendValueInput("PERIOD").setCheck("Number").appendField("Period:");
        this.appendValueInput("UPPER").setCheck("Number").appendField("Std Dev:");
        this.appendDummyInput()
            .appendField("Field:")
            .appendField(new Blockly.FieldDropdown([["Upper", "0"], ["Middle", "1"], ["Lower", "2"]]), "BB_FIELD");
        this.setOutput(true, "Number");
        this.setStyle('analysis_blocks');
      }
    };

    Blockly.Blocks['timeout'] = {
      init: function() {
        this.appendValueInput("SECONDS").setCheck("Number").appendField("Run after");
        this.appendDummyInput().appendField("second(s)");
        this.appendStatementInput("STACK");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#eeeeee");
      }
    };

    Blockly.Blocks['loader'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Load Strategy from URL:")
            .appendField(new Blockly.FieldTextInput("https://..."), "URL");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(290);
      }
    };

    Blockly.Blocks['totp_code'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("TOTP Code for Secret:")
            .appendField(new Blockly.FieldTextInput(""), "SECRET");
        this.setOutput(true, "String");
        this.setColour("#ffffff");
      }
    };

    Blockly.Blocks['is_replace_variable'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("Replace Variable")
            .appendField(new Blockly.FieldVariable("item"), "VAR")
            .appendField("with")
            .appendField(new Blockly.FieldVariable("item2"), "VAR2");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(330);
      }
    };

    registerProcedureBlocks(Blockly);
    setDerivWorkspace(workspace.current);

    (javascriptGenerator as any).getVariableName = function(name: string) {
      return (javascriptGenerator as any).nameDB_.getName(name, (Blockly as any).VARIABLE_CATEGORY_NAME);
    };

    // Custom Block Generators
    (javascriptGenerator as any).forBlock['trade_definition_multiplier'] = function(block: Blockly.Block) {
      const multiplier = block.getFieldValue('MULTIPLIERTYPE_LIST');
      const currency = block.getFieldValue('CURRENCY_LIST');
      const amount = (javascriptGenerator as any).valueToCode(block, 'AMOUNT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `Bot.setMultiplierParams({ multiplier: ${multiplier}, currency: '${currency}', amount: ${amount} });\n`;
    };

    (javascriptGenerator as any).forBlock['multiplier_take_profit'] = function(block: Blockly.Block) {
      const amount = (javascriptGenerator as any).valueToCode(block, 'AMOUNT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `Bot.setMultiplierTakeProfit(${amount});\n`;
    };

    (javascriptGenerator as any).forBlock['multiplier_stop_loss'] = function(block: Blockly.Block) {
      const amount = (javascriptGenerator as any).valueToCode(block, 'AMOUNT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `Bot.setMultiplierStopLoss(${amount});\n`;
    };

    (javascriptGenerator as any).forBlock['smaa_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const statement = (javascriptGenerator as any).statementToCode(block, 'STATEMENT');
      return `${variable} = Bot.smaArray(${statement});\n`;
    };

    (javascriptGenerator as any).forBlock['bba_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const result = block.getFieldValue('BBRESULT_LIST');
      const statement = (javascriptGenerator as any).statementToCode(block, 'STATEMENT');
      return `${variable} = Bot.bbArray(${statement}, ${result});\n`;
    };

    (javascriptGenerator as any).forBlock['emaa_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const statement = (javascriptGenerator as any).statementToCode(block, 'STATEMENT');
      return `${variable} = Bot.emaArray(${statement});\n`;
    };

    (javascriptGenerator as any).forBlock['rsia_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const statement = (javascriptGenerator as any).statementToCode(block, 'STATEMENT');
      return `${variable} = Bot.rsiArray(${statement});\n`;
    };

    (javascriptGenerator as any).forBlock['macda_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const field = block.getFieldValue('MACDFIELDS_LIST');
      const statement = (javascriptGenerator as any).statementToCode(block, 'STATEMENT');
      return `${variable} = Bot.macdArray(${statement}, ${field});\n`;
    };

    (javascriptGenerator as any).forBlock['std_dev_multiplier_up'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'UPMULTIPLIER', (javascriptGenerator as any).ORDER_ATOMIC) || '2';
      return `stdDevUp: ${val},\n`;
    };

    (javascriptGenerator as any).forBlock['std_dev_multiplier_down'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'DOWNMULTIPLIER', (javascriptGenerator as any).ORDER_ATOMIC) || '2';
      return `stdDevDown: ${val},\n`;
    };

    (javascriptGenerator as any).forBlock['fast_ema_period'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'FAST_EMA_PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '12';
      return `fastPeriod: ${val},\n`;
    };

    (javascriptGenerator as any).forBlock['slow_ema_period'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'SLOW_EMA_PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '26';
      return `slowPeriod: ${val},\n`;
    };

    (javascriptGenerator as any).forBlock['signal_ema_period'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'SIGNAL_EMA_PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '9';
      return `signalPeriod: ${val},\n`;
    };

    (javascriptGenerator as any).forBlock['stat'] = function() {
      return [`Bot.getStat()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['stat_list'] = function() {
      return [`Bot.getStatList()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['consecutive_digits'] = function(block: Blockly.Block) {
      const count = block.getFieldValue('COUNT');
      return [`Bot.getConsecutiveDigit(${count})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lastDigitList'] = function() {
      return [`Bot.getLastDigitList()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['read_ohlc_obj'] = function(block: Blockly.Block) {
      const field = block.getFieldValue('OHLCFIELD_LIST');
      const obj = (javascriptGenerator as any).valueToCode(block, 'OHLCOBJ', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      return [`Bot.readOHLCObj(${obj}, '${field}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['ohlc_values_in_list'] = function(block: Blockly.Block) {
      const field = block.getFieldValue('OHLCFIELD_LIST');
      const list = (javascriptGenerator as any).valueToCode(block, 'OHLCLIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      return [`Bot.getOHLCValuesInList(${list}, '${field}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['sell_price'] = function() {
      return [`Bot.getSellPrice()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['payout'] = function() {
      return [`Bot.getPayout()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['ask_price'] = function() {
      return [`Bot.getAskPrice()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['notify_telegram'] = function(block: Blockly.Block) {
      const token = (javascriptGenerator as any).valueToCode(block, 'TELEGRAM_ACCESS_TOKEN', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const chatId = (javascriptGenerator as any).valueToCode(block, 'TELEGRAM_CHAT_ID', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const message = (javascriptGenerator as any).valueToCode(block, 'TELEGRAM_MESSAGE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return `Bot.notifyTelegram(${token}, ${chatId}, ${message});\n`;
    };

    (javascriptGenerator as any).forBlock['epoch'] = function() {
      return [`Bot.getEpoch()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['tick_delay'] = function(block: Blockly.Block) {
      const delay = (javascriptGenerator as any).valueToCode(block, 'DELAY', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      return `Bot.tickDelay(${delay});\n`;
    };

    (javascriptGenerator as any).forBlock['totimestamp'] = function(block: Blockly.Block) {
      const datetime = (javascriptGenerator as any).valueToCode(block, 'DATETIME', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return [`Bot.toTimestamp(${datetime})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['todatetime'] = function(block: Blockly.Block) {
      const timestamp = (javascriptGenerator as any).valueToCode(block, 'TIMESTAMP', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return [`Bot.toDateTime(${timestamp})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_trig'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const num = (javascriptGenerator as any).valueToCode(block, 'NUM', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return [`Math.${op.toLowerCase()}(${num})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_modulo'] = function(block: Blockly.Block) {
      const dividend = (javascriptGenerator as any).valueToCode(block, 'DIVIDEND', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const divisor = (javascriptGenerator as any).valueToCode(block, 'DIVISOR', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      return [`${dividend} % ${divisor}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_constrain'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const low = (javascriptGenerator as any).valueToCode(block, 'LOW', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const high = (javascriptGenerator as any).valueToCode(block, 'HIGH', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return [`Math.min(Math.max(${val}, ${low}), ${high})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_append'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      const text = (javascriptGenerator as any).valueToCode(block, 'TEXT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return `${variable} += ${text};\n`;
    };

    (javascriptGenerator as any).forBlock['text_length'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return [`${val}.length`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_isEmpty'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return [`!${val}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_indexOf'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const find = (javascriptGenerator as any).valueToCode(block, 'FIND', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const mode = block.getFieldValue('END') === 'FIRST' ? 'indexOf' : 'lastIndexOf';
      return [`${val}.${mode}(${find})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_charAt'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const where = block.getFieldValue('WHERE');
      let code = '';
      if (where === 'FROM_START') {
        const at = (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
        code = `${val}.charAt(${at} - 1)`;
      } else if (where === 'FROM_END') {
        const at = (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
        code = `${val}.charAt(${val}.length - ${at})`;
      } else if (where === 'FIRST') {
        code = `${val}.charAt(0)`;
      } else if (where === 'LAST') {
        code = `${val}.charAt(${val}.length - 1)`;
      } else if (where === 'RANDOM') {
        code = `${val}.charAt(Math.floor(Math.random() * ${val}.length))`;
      }
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_getSubstring'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'STRING', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const where1 = block.getFieldValue('WHERE1');
      const where2 = block.getFieldValue('WHERE2');
      const at1 = (javascriptGenerator as any).valueToCode(block, 'AT1', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      const at2 = (javascriptGenerator as any).valueToCode(block, 'AT2', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      
      let start = '0';
      if (where1 === 'FROM_START') start = `${at1} - 1`;
      else if (where1 === 'FROM_END') start = `${val}.length - ${at1}`;
      
      let end = `${val}.length`;
      if (where2 === 'FROM_START') end = `${at2}`;
      else if (where2 === 'FROM_END') end = `${val}.length - ${at2} + 1`;
      
      return [`${val}.substring(${start}, ${end})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_changeCase'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'TEXT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const mode = block.getFieldValue('CASE');
      let code = '';
      if (mode === 'UPPERCASE') code = `${val}.toUpperCase()`;
      else if (mode === 'LOWERCASE') code = `${val}.toLowerCase()`;
      else if (mode === 'TITLECASE') code = `${val}.replace(/\\b\\w/g, l => l.toUpperCase())`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text_trim'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'TEXT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const mode = block.getFieldValue('MODE');
      let code = '';
      if (mode === 'BOTH') code = `${val}.trim()`;
      else if (mode === 'LEFT') code = `${val}.trimStart()`;
      else if (mode === 'RIGHT') code = `${val}.trimEnd()`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_repeat'] = function(block: Blockly.Block) {
      const item = (javascriptGenerator as any).valueToCode(block, 'ITEM', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      const num = (javascriptGenerator as any).valueToCode(block, 'NUM', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return [`Array(${num}).fill(${item})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_isEmpty'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      return [`${val}.length === 0`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_indexOf'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const find = (javascriptGenerator as any).valueToCode(block, 'FIND', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      const mode = block.getFieldValue('END') === 'FIRST' ? 'indexOf' : 'lastIndexOf';
      return [`${val}.${mode}(${find})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_getSublist'] = function(block: Blockly.Block) {
      const val = (javascriptGenerator as any).valueToCode(block, 'LIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const where1 = block.getFieldValue('WHERE1');
      const where2 = block.getFieldValue('WHERE2');
      const at1 = (javascriptGenerator as any).valueToCode(block, 'AT1', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      const at2 = (javascriptGenerator as any).valueToCode(block, 'AT2', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      
      let start = '0';
      if (where1 === 'FROM_START') start = `${at1} - 1`;
      else if (where1 === 'FROM_END') start = `${val}.length - ${at1}`;
      
      let end = `${val}.length`;
      if (where2 === 'FROM_START') end = `${at2}`;
      else if (where2 === 'FROM_END') end = `${val}.length - ${at2} + 1`;
      
      return [`${val}.slice(${start}, ${end})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_split'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const delim = (javascriptGenerator as any).valueToCode(block, 'DELIM', (javascriptGenerator as any).ORDER_ATOMIC) || "','";
      const mode = block.getFieldValue('MODE');
      let code = '';
      if (mode === 'SPLIT') code = `${input}.split(${delim})`;
      else if (mode === 'JOIN') code = `${input}.join(${delim})`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_sort'] = function(block: Blockly.Block) {
      const list = (javascriptGenerator as any).valueToCode(block, 'LIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const type = block.getFieldValue('TYPE');
      const order = block.getFieldValue('ORDER');
      let code = `[...${list}].sort((a, b) => {`;
      if (type === 'NUMERIC') {
        code += `return (Number(a) - Number(b)) * ${order};`;
      } else if (type === 'ALPHABETIC') {
        code += `return a.toString().localeCompare(b.toString()) * ${order};`;
      } else if (type === 'IGNORE_CASE') {
        code += `return a.toString().toLowerCase().localeCompare(b.toString().toLowerCase()) * ${order};`;
      }
      code += `})`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['controls_repeat'] = function(block: Blockly.Block) {
      const times = block.getFieldValue('TIMES');
      const stack = (javascriptGenerator as any).statementToCode(block, 'DO');
      return `for (let i = 0; i < ${times}; i++) {\n${stack}}\n`;
    };

    (javascriptGenerator as any).forBlock['controls_repeat_ext'] = function(block: Blockly.Block) {
      const times = (javascriptGenerator as any).valueToCode(block, 'TIMES', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const stack = (javascriptGenerator as any).statementToCode(block, 'DO');
      return `for (let i = 0; i < ${times}; i++) {\n${stack}}\n`;
    };

    (javascriptGenerator as any).forBlock['block_holder'] = function(block: Blockly.Block) {
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      return stack;
    };

    (javascriptGenerator as any).forBlock['console'] = function(block: Blockly.Block) {
      const message = (javascriptGenerator as any).valueToCode(block, 'MESSAGE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return `console.log(${message});\n`;
    };

    (javascriptGenerator as any).forBlock['trade_definition'] = function(block: Blockly.Block) {
      const tradeOptions = (javascriptGenerator as any).statementToCode(block, 'TRADE_OPTIONS');
      const submarket = (javascriptGenerator as any).statementToCode(block, 'SUBMARKET');
      const initialization = (javascriptGenerator as any).statementToCode(block, 'INITIALIZATION');
      
      return `
        window.INITIALIZATION = async function() {
          ${initialization}
          ${submarket}
        };
        window.TRADE_OPTIONS = async function() {
          ${tradeOptions}
        };
      `;
    };

    (javascriptGenerator as any).forBlock['trade_definition_market'] = function(block: Blockly.Block) {
      const market = block.getFieldValue('MARKET_LIST');
      const submarket = block.getFieldValue('SUBMARKET_LIST');
      const symbol = block.getFieldValue('SYMBOL_LIST');
      return `Bot.setMarket('${market}');\nBot.setSubmarket('${submarket}');\nBot.setSymbol('${symbol}');\n`;
    };

    delete (javascriptGenerator as any).forBlock['trade_definition_tradetype'];
    (javascriptGenerator as any).forBlock['trade_definition_tradetype'] = function(block: Blockly.Block) {
      const category = block.getFieldValue('TRADETYPECAT_LIST') || 'callput';
      const type = block.getFieldValue('TRADETYPE_LIST') || 'callput';
      return `Bot.setTradeTypeCategory('${category}');\nBot.setTradeType('${type}');\n`;
    };

    delete (javascriptGenerator as any).forBlock['trade_definition_contracttype'];
    (javascriptGenerator as any).forBlock['trade_definition_contracttype'] = function(block: Blockly.Block) {
      const type = block.getFieldValue('TYPE_LIST') || 'both';
      return `Bot.setContractType('${type}');\n`;
    };

    (javascriptGenerator as any).forBlock['trade_definition_candleinterval'] = function(block: Blockly.Block) {
      const interval = block.getFieldValue('CANDLEINTERVAL_LIST');
      return `Bot.setCandleInterval('${interval}');\n`;
    };

    (javascriptGenerator as any).forBlock['trade_definition_restartonerror'] = function(block: Blockly.Block) {
      const restart = block.getFieldValue('RESTARTONERROR') === 'TRUE';
      return `Bot.setRestartOnError(${restart});\n`;
    };

    (javascriptGenerator as any).forBlock['trade_definition_switch_market'] = function(block: Blockly.Block) {
      const symbol = block.getFieldValue('SYMBOL_LIST');
      return `Bot.switchMarket('${symbol}');\n`;
    };

    (javascriptGenerator as any).forBlock['scan_volatility_markets'] = function(block: Blockly.Block) {
      const criterion = block.getFieldValue('CRITERION') || 'statistical_edge';
      const autoSwitch = block.getFieldValue('AUTO_SWITCH') === 'TRUE';
      return `Bot.scanAndSelectBestVolatilityMarket('${criterion}', ${autoSwitch});\n`;
    };

    (javascriptGenerator as any).forBlock['best_volatility_market'] = function() {
      return [`Bot.getBestVolatilityMarket()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['rotate_volatility_market'] = function(block: Blockly.Block) {
      const condition = block.getFieldValue('CONDITION') || 'on_win';
      return `Bot.rotateVolatilityMarket('${condition}');\n`;
    };

    (javascriptGenerator as any).forBlock['check_digit_pattern_sequence'] = function(block: Blockly.Block) {
      const pattern = block.getFieldValue('PATTERN') || 'differs9_under9_under8';
      return [`Bot.checkDigitPatternSequence('${pattern}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['set_entry_armed'] = function(block: Blockly.Block) {
      const armed = block.getFieldValue('ARMED') === 'TRUE';
      return `Bot.setEntryArmed(${armed});\n`;
    };

    (javascriptGenerator as any).forBlock['is_entry_armed'] = function() {
      return [`Bot.isEntryArmed()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_number_positive'] = function(block: any) {
      return [block.getFieldValue('NUM'), (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_create_with'] = function(block: any) {
      const variable = (javascriptGenerator as any).nameDB_.getName(block.getFieldValue('VARIABLE'), (Blockly as any).VARIABLE_CATEGORY_NAME);
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      return `${variable} = [${stack.split(',\n').filter((s: string) => s.trim()).join(', ')}];\n`;
    };

    (javascriptGenerator as any).forBlock['lists_statement'] = function(block: any) {
      const value = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_NONE) || 'null';
      return value + ',\n';
    };

    delete (javascriptGenerator as any).forBlock['trade_definition_tradeoptions'];
    (javascriptGenerator as any).forBlock['trade_definition_tradeoptions'] = function(block: Blockly.Block) {
      const durationType = block.getFieldValue('DURATIONTYPE_LIST');
      const duration = (javascriptGenerator as any).valueToCode(block, 'DURATION', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const amount = (javascriptGenerator as any).valueToCode(block, 'AMOUNT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const takeProfit = (javascriptGenerator as any).valueToCode(block, 'TAKE_PROFIT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const stopLoss = (javascriptGenerator as any).valueToCode(block, 'STOP_LOSS', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      
      const predictionInput = block.getInput('PREDICTION');
      let prediction = 'undefined';
      if (predictionInput && predictionInput.isVisible()) {
        prediction = (javascriptGenerator as any).valueToCode(block, 'PREDICTION', (javascriptGenerator as any).ORDER_ATOMIC) || 'undefined';
      }

      const barrierInput = block.getInput('BARRIER');
      let barrier = 'undefined';
      let barrierType = block.getFieldValue('BARRIER_TYPE') || 'offset_plus';
      const rawBarrier = (javascriptGenerator as any).valueToCode(block, 'BARRIER', (javascriptGenerator as any).ORDER_ATOMIC);
      if (rawBarrier && rawBarrier !== '' && rawBarrier !== 'undefined' && rawBarrier !== 'null') {
        barrier = rawBarrier;
      } else if (barrierInput && barrierInput.isVisible()) {
        barrier = "'+0.37'";
      }
      
      return `Bot.setTradeOptions({ 
        durationType: '${durationType}', 
        duration: ${duration}, 
        amount: ${amount}, 
        takeProfit: ${takeProfit},
        stopLoss: ${stopLoss},
        prediction: ${prediction}, 
        barrier: ${barrier},
        barrierType: '${barrierType}'
      });\n`;
    };

    (javascriptGenerator as any).forBlock['trade_definition_accumulator'] = function(block: Blockly.Block) {
      const growthRate = block.getFieldValue('GROWTHRATE_LIST') || '0.01';
      const amount = (javascriptGenerator as any).valueToCode(block, 'AMOUNT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const takeProfit = (javascriptGenerator as any).valueToCode(block, 'TAKE_PROFIT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `
        Bot.setAccumulatorParams({ growthRate: ${growthRate}, amount: ${amount} });
        Bot.setAccumulatorTakeProfit(${takeProfit});
      \n`;
    };

    (javascriptGenerator as any).forBlock['accu_tp_limit'] = function(block: Blockly.Block) {
      const percent = (javascriptGenerator as any).valueToCode(block, 'PERCENT', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const code = `Number((Bot.getAmount() * (${percent} / 100)).toFixed(2))`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['no_of_runs'] = function(block: Blockly.Block) {
      const runs = (javascriptGenerator as any).valueToCode(block, 'NO_OF_RUNS', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const code = `Bot.noOfRuns(${runs})`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['before_purchase'] = function(block: Blockly.Block) {
      const stack = (javascriptGenerator as any).statementToCode(block, 'BEFOREPURCHASE_STACK');
      return `
        window.BEFORE_PURCHASE = async function() {
          ${stack}
        };
      `;
    };

    delete (javascriptGenerator as any).forBlock['purchase'];
    (javascriptGenerator as any).forBlock['purchase'] = function(block: Blockly.Block) {
      const type = block.getFieldValue('PURCHASE_LIST') || 'RISE';
      return `Bot.purchase('${type}');\n`;
    };

    (javascriptGenerator as any).forBlock['purchase_dual'] = function(block: Blockly.Block) {
      const type1 = block.getFieldValue('TYPE1');
      const type2 = block.getFieldValue('TYPE2');
      return `Bot.purchaseDual('${type1}', '${type2}');\n`;
    };

    (javascriptGenerator as any).forBlock['purchase_over_under_dual'] = function(block: Blockly.Block) {
      const overBarrier = (javascriptGenerator as any).valueToCode(block, 'OVER_BARRIER', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      const underBarrier = (javascriptGenerator as any).valueToCode(block, 'UNDER_BARRIER', (javascriptGenerator as any).ORDER_ATOMIC) || '8';
      return `Bot.purchaseDual('DIGITOVER', 'DIGITUNDER', ${overBarrier}, ${underBarrier});\n`;
    };

    (javascriptGenerator as any).forBlock['purchase_dual_with_barriers'] = function(block: Blockly.Block) {
      const type1 = block.getFieldValue('TYPE1');
      const barrier1 = (javascriptGenerator as any).valueToCode(block, 'BARRIER1', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      const type2 = block.getFieldValue('TYPE2');
      const barrier2 = (javascriptGenerator as any).valueToCode(block, 'BARRIER2', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      return `Bot.purchaseDual('${type1}', '${type2}', ${barrier1}, ${barrier2});\n`;
    };

    (javascriptGenerator as any).forBlock['during_purchase'] = function(block: Blockly.Block) {
      const stack = (javascriptGenerator as any).statementToCode(block, 'DURING_PURCHASE_STACK');
      return `
        window.DURING_PURCHASE = async function() {
          ${stack}
        };
      `;
    };

    (javascriptGenerator as any).forBlock['after_purchase'] = function(block: Blockly.Block) {
      const stack = (javascriptGenerator as any).statementToCode(block, 'AFTERPURCHASE_STACK');
      return `
        window.AFTER_PURCHASE = async function() {
          ${stack}
        };
      `;
    };

    (javascriptGenerator as any).forBlock['trade_again'] = function(block: Blockly.Block) {
      return `await Bot.tradeAgain();\n`;
    };

    (javascriptGenerator as any).forBlock['stop_bot'] = function(block: Blockly.Block) {
      return `Bot.stop();\n`;
    };

    (javascriptGenerator as any).forBlock['notify'] = function(block: Blockly.Block) {
      const type = block.getFieldValue('NOTIFICATION_TYPE');
      const sound = block.getFieldValue('NOTIFICATION_SOUND');
      const message = (javascriptGenerator as any).valueToCode(block, 'MESSAGE', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return `Bot.notify('${type}', ${message}, '${sound}');\n`;
    };

    (javascriptGenerator as any).forBlock['last_tick'] = function() {
      return [`Bot.getLastTick()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['last_digit'] = function() {
      return [`Bot.getLastDigit()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['last_digit_pattern'] = function() {
      const code = 'Bot.getLastDigitList().slice(-3).join(",")';
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['least_digit'] = function() {
      return [`Bot.getLeastDigit()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['least_frequent_digit'] = function() {
      return [`Bot.getLeastFrequentDigit()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['most_frequent_digit'] = function() {
      return [`Bot.getMostFrequentDigit()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['rise_fall_signal'] = function() {
      return [`Bot.getRiseFallSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['even_odd_signal'] = function() {
      return [`Bot.getEvenOddSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['over_under_signal'] = function() {
      return [`Bot.getOverUnderSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['differ_signal'] = function() {
      return [`Bot.getDifferSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['accumulator_signal'] = function() {
      return [`Bot.getAccumulatorSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['accu_noise_calm_buy'] = function() {
      return [`Bot.getAccuNoiseSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['match_signal'] = function() {
      return [`Bot.getMatchSignal()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['total_profit'] = function() {
      return [`Bot.getTotalProfit()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['total_runs'] = function() {
      return [`Bot.getTotalRuns()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['total_win'] = function() {
      return [`Bot.getTotalWin()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['total_loss'] = function() {
      return [`Bot.getTotalLoss()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['consecutive_loss_count'] = function() {
      return [`Bot.getConsecutiveLosses()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['contract_check_result'] = function(block: Blockly.Block) {
      const result = block.getFieldValue('CHECK_RESULT');
      return [`Bot.checkResult('${result}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['is_purchasing'] = function() {
      return [`Bot.isPurchasing()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['is_closed'] = function() {
      return [`Bot.isClosed()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['set_prediction_single'] = function(block: Blockly.Block) {
      const prediction = javascriptGenerator.valueToCode(block, 'PREDICTION', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `Bot.setPrediction(${prediction});\n`;
    };

    (javascriptGenerator as any).forBlock['set_prediction'] = function(block: Blockly.Block) {
      const prediction = javascriptGenerator.valueToCode(block, 'PREDICTION', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const prediction2 = javascriptGenerator.valueToCode(block, 'PREDICTION2', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `Bot.setPredictionDual(${prediction}, ${prediction2});\n`;
    };

    (javascriptGenerator as any).forBlock['set_barrier_offset'] = function(block: Blockly.Block) {
      const barrier = (javascriptGenerator as any).valueToCode(block, 'BARRIER', (javascriptGenerator as any).ORDER_ATOMIC) || '0.5';
      const barrierType = block.getFieldValue('BARRIER_TYPE') || 'offset_plus';
      return `Bot.setBarrier(${barrier}, '${barrierType}');\n`;
    };

    (javascriptGenerator as any).forBlock['digit_signal_pattern'] = function(block: Blockly.Block) {
      return [`Bot.getDigitSignalPattern()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['digit_pattern'] = function(block: Blockly.Block) {
      const signal = javascriptGenerator.valueToCode(block, 'SIGNAL', (javascriptGenerator as any).ORDER_ATOMIC);
      return [`${signal}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['read_details'] = function(block: Blockly.Block) {
      const detail = block.getFieldValue('DETAIL_INDEX');
      return [`Bot.readDetail('${detail}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['balance'] = function(block: Blockly.Block) {
      const type = block.getFieldValue('BALANCE_TYPE');
      return [`Bot.getBalance('${type}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['trade_definition_restartbuysell'] = function(block: Blockly.Block) {
      const restart = block.getFieldValue('TIME_MACHINE_ENABLED') === 'TRUE';
      return `Bot.setRestartBuySell(${restart});\n`;
    };

    (javascriptGenerator as any).forBlock['check_sell'] = function() {
      return [`Bot.checkSell()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['sell_at_market'] = function() {
      return `Bot.sellAtMarket();\n`;
    };

    (javascriptGenerator as any).forBlock['get_payout'] = function() {
      return [`Bot.getPayout()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['ticks'] = function() {
      return [`Bot.getTicks()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['ohlc'] = function() {
      return [`Bot.getOHLC()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['main_account'] = function() {
      return [`Bot.getMainAccount()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['is_candle_black'] = function(block: Blockly.Block) {
      const ohlc = (javascriptGenerator as any).valueToCode(block, 'OHLC', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      return [`Bot.isCandleBlack(${ohlc})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['read_ohlc'] = function(block: Blockly.Block) {
      const field = block.getFieldValue('OHLC_FIELD');
      const ohlc = (javascriptGenerator as any).valueToCode(block, 'OHLC', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      return [`Bot.readOHLC(${ohlc}, '${field}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['get_ohlc'] = function(block: Blockly.Block) {
      const source = block.getFieldValue('SOURCE');
      const index = (javascriptGenerator as any).valueToCode(block, 'INDEX', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return [`Bot.getOHLCFromSource('${source}', ${index})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['sma'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return [`Bot.sma(${input}, ${period})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['ema'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return [`Bot.ema(${input}, ${period})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['bb'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      const stdDev = (javascriptGenerator as any).valueToCode(block, 'UPPER', (javascriptGenerator as any).ORDER_ATOMIC) || '2';
      const field = block.getFieldValue('BB_FIELD');
      const fieldMap: Record<string, string> = { '0': 'upper', '1': 'middle', '2': 'lower' };
      return [`Bot.bb(${input}, ${period}, ${stdDev}, '${fieldMap[field]}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['rsi_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).nameDB_.getName(block.getFieldValue('VARIABLE'), (Blockly as any).VARIABLE_CATEGORY_NAME);
      const statement = (javascriptGenerator as any).statementToCode(block, 'STATEMENT');
      // This is a bit tricky, rsi_statement seems to be designed to set a variable
      // but the block structure in init suggests it has an "Input" statement.
      // Let's assume it's used to calculate RSI and store it in the variable.
      // We need to extract period and input from the statement if they are blocks inside.
      return `${variable} = Bot.rsi(Bot.getTicks(), 14);\n${statement}`;
    };

    (javascriptGenerator as any).forBlock['tick'] = function() {
      return [`Bot.getLastTick()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['timeout'] = function(block: Blockly.Block) {
      const seconds = (javascriptGenerator as any).valueToCode(block, 'SECONDS', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      return `await Bot.sleep(${seconds});\n${stack}\n`;
    };

    (javascriptGenerator as any).forBlock['loader'] = function(block: Blockly.Block) {
      const url = block.getFieldValue('URL');
      return `Bot.loadStrategy('${url}');\n`;
    };

    (javascriptGenerator as any).forBlock['totp_code'] = function(block: Blockly.Block) {
      const secret = block.getFieldValue('SECRET');
      return [`Bot.getTOTPCode('${secret}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['tick_analysis'] = function(block: Blockly.Block) {
      const stack = (javascriptGenerator as any).statementToCode(block, 'TICKANALYSIS_STACK');
      return `
        window.TICK_ANALYSIS = async function() {
          ${stack}
        };
      `;
    };



    (javascriptGenerator as any).forBlock['direction'] = function() {
      return [`Bot.getDirection()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['check_direction'] = function(block: Blockly.Block) {
      const direction = block.getFieldValue('DIRECTION');
      return [`Bot.getDirection() === '${direction}'`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['trade'] = function(block: Blockly.Block) {
      const market = block.getFieldValue('MARKET_LIST');
      const submarket = block.getFieldValue('SUBMARKET_LIST');
      const symbol = block.getFieldValue('SYMBOL_LIST');
      const category = block.getFieldValue('TRADETYPECAT_LIST');
      const type = block.getFieldValue('TRADETYPE_LIST');
      const contractType = block.getFieldValue('TYPE_LIST');
      const interval = block.getFieldValue('CANDLEINTERVAL_LIST');
      const restartBuySell = block.getFieldValue('TIME_MACHINE_ENABLED') === 'TRUE';
      const restartOnError = block.getFieldValue('RESTARTONERROR') === 'TRUE';
      const initialization = (javascriptGenerator as any).statementToCode(block, 'INITIALIZATION');
      
      return `
        Bot.setMarket('${market}', '${submarket}', '${symbol}');
        Bot.setTradeType('${category}', '${type}');
        Bot.setContractType('${contractType}');
        Bot.setCandleInterval('${interval}');
        Bot.setRestartBuySell(${restartBuySell});
        Bot.setRestartOnError(${restartOnError});
        window.INITIALIZATION = function() {
          ${initialization}
        };
        window.TRADE_OPTIONS = function() {
          // Default trade options for legacy trade block
        };
      `;
    };

    (javascriptGenerator as any).forBlock['rsi_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const input = (javascriptGenerator as any).valueToCode(block, 'STATEMENT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return `${variable} = Bot.rsi(${input}, ${period});\n`;
    };

    (javascriptGenerator as any).forBlock['input_list'] = function(block: Blockly.Block) {
      const list = (javascriptGenerator as any).valueToCode(block, 'INPUT_LIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      return [`${list}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['period'] = function(block: Blockly.Block) {
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return [period, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['tick'] = function() {
      return [`Bot.getLastTick()`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['sma'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return [`Bot.sma(${input}, ${period})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['ema'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return [`Bot.ema(${input}, ${period})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['bb'] = function(block: Blockly.Block) {
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      const stdDev = (javascriptGenerator as any).valueToCode(block, 'UPPER', (javascriptGenerator as any).ORDER_ATOMIC) || '2';
      const field = block.getFieldValue('BB_FIELD');
      return [`Bot.bb(${input}, ${period}, ${stdDev}, ${field})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    // Redundant timeout block removed to prevent conflict

    (javascriptGenerator as any).forBlock['loader'] = function(block: Blockly.Block) {
      const url = block.getFieldValue('URL');
      return `Bot.loadStrategy('${url}');\n`;
    };

    (javascriptGenerator as any).forBlock['totp_code'] = function(block: Blockly.Block) {
      const secret = block.getFieldValue('SECRET');
      return [`Bot.getTOTPCode('${secret}')`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['is_replace_variable'] = function(block: Blockly.Block) {
      const var1 = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      const var2 = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR2'));
      return `${var1} = ${var2};\n`;
    };

    (javascriptGenerator as any).forBlock['controls_if'] = function(block: Blockly.Block) {
      let n = 0;
      let code = '';
      let conditionCode = (javascriptGenerator as any).valueToCode(block, 'IF' + n, (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      let branchCode = (javascriptGenerator as any).statementToCode(block, 'DO' + n);
      code += 'if (' + conditionCode + ') {\n' + branchCode + '}';
      for (n = 1; n <= (block as any).elseifCount_ || 0; n++) {
        conditionCode = (javascriptGenerator as any).valueToCode(block, 'IF' + n, (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
        branchCode = (javascriptGenerator as any).statementToCode(block, 'DO' + n);
        code += ' else if (' + conditionCode + ') {\n' + branchCode + '}';
      }
      if ((block as any).elseCount_) {
        branchCode = (javascriptGenerator as any).statementToCode(block, 'ELSE');
        code += ' else {\n' + branchCode + '}';
      }
      return code + '\n';
    };

    (javascriptGenerator as any).forBlock['logic_compare'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const a = (javascriptGenerator as any).valueToCode(block, 'A', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const b = (javascriptGenerator as any).valueToCode(block, 'B', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const opMap: any = { 'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 'GT': '>', 'GTE': '>=' };
      return [`${a} ${opMap[op]} ${b}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_on_list'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const list = (javascriptGenerator as any).valueToCode(block, 'LIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      let code = '';
      switch (op) {
        case 'SUM':
          code = `${list}.reduce((a, b) => a + b, 0)`;
          break;
        case 'MIN':
          code = `Math.min(...${list})`;
          break;
        case 'MAX':
          code = `Math.max(...${list})`;
          break;
        case 'AVERAGE':
          code = `(${list}.reduce((a, b) => a + b, 0) / ${list}.length)`;
          break;
        case 'MEDIAN':
          code = `(function(l){l.sort((a,b)=>a-b);const m=Math.floor(l.length/2);return l.length%2?l[m]:(l[m-1]+l[m])/2})([...${list}])`;
          break;
        case 'MODE':
          code = `(function(l){const c={};let m=0,v=[];l.forEach(x=>{c[x]=(c[x]||0)+1;if(c[x]>m){m=c[x];v=[x]}else if(c[x]===m)v.push(x)});return v[0]})(${list})`;
          break;
        case 'STD_DEV':
          code = `(function(l){const a=l.reduce((x,y)=>x+y,0)/l.length;return Math.sqrt(l.reduce((x,y)=>x+Math.pow(y-a,2),0)/l.length)})(${list})`;
          break;
        case 'RANDOM':
          code = `${list}[Math.floor(Math.random() * ${list}.length)]`;
          break;
      }
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_arithmetic'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const a = (javascriptGenerator as any).valueToCode(block, 'A', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const b = (javascriptGenerator as any).valueToCode(block, 'B', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const opMap: any = { 'ADD': '+', 'MINUS': '-', 'MULTIPLY': '*', 'DIVIDE': '/', 'POWER': '**' };
      return [`${a} ${opMap[op]} ${b}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['logic_null'] = function() {
      return [`null`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['logic_negate'] = function(block: Blockly.Block) {
      const bool = (javascriptGenerator as any).valueToCode(block, 'BOOL', (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      return [`!${bool}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['logic_operation'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const a = (javascriptGenerator as any).valueToCode(block, 'A', (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      const b = (javascriptGenerator as any).valueToCode(block, 'B', (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      const opMap: any = { 'AND': '&&', 'OR': '||' };
      return [`${a} ${opMap[op]} ${b}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['controls_whileUntil'] = function(block: Blockly.Block) {
      const mode = block.getFieldValue('MODE');
      const condition = (javascriptGenerator as any).valueToCode(block, 'BOOL', (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      const stack = (javascriptGenerator as any).statementToCode(block, 'DO');
      const loopCondition = mode === 'WHILE' ? condition : `!${condition}`;
      return `while (${loopCondition}) {\n${stack}}\n`;
    };

    (javascriptGenerator as any).forBlock['controls_for'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      const from = (javascriptGenerator as any).valueToCode(block, 'FROM', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const to = (javascriptGenerator as any).valueToCode(block, 'TO', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const by = (javascriptGenerator as any).valueToCode(block, 'BY', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
      const stack = (javascriptGenerator as any).statementToCode(block, 'DO');
      return `for (${variable} = ${from}; ${variable} <= ${to}; ${variable} += ${by}) {\n${stack}}\n`;
    };

    (javascriptGenerator as any).forBlock['controls_forEach'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      const list = (javascriptGenerator as any).valueToCode(block, 'LIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const stack = (javascriptGenerator as any).statementToCode(block, 'DO');
      return `${list}.forEach(function(${variable}) {\n${stack}});\n`;
    };

    (javascriptGenerator as any).forBlock['controls_flow_statements'] = function(block: Blockly.Block) {
      const flow = block.getFieldValue('FLOW');
      return flow === 'BREAK' ? 'break;\n' : 'continue;\n';
    };

    (javascriptGenerator as any).forBlock['variables_set'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      const value = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      return `${variable} = ${value};\n`;
    };

    (javascriptGenerator as any).forBlock['variables_get'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      return [variable, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['procedures_defnoreturn'] = function(block: Blockly.Block) {
      const name = (javascriptGenerator as any).getVariableName(block.getFieldValue('NAME'));
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      const args = (block as any).arguments || [];
      const argsCode = args.map((arg: string) => (javascriptGenerator as any).getVariableName(arg)).join(', ');
      return `function ${name}(${argsCode}) {\n${stack}}\n`;
    };

    (javascriptGenerator as any).forBlock['procedures_defreturn'] = function(block: Blockly.Block) {
      const name = (javascriptGenerator as any).getVariableName(block.getFieldValue('NAME'));
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      const returnValue = (javascriptGenerator as any).valueToCode(block, 'RETURN', (javascriptGenerator as any).ORDER_ATOMIC) || '';
      const args = (block as any).arguments || [];
      const argsCode = args.map((arg: string) => (javascriptGenerator as any).getVariableName(arg)).join(', ');
      return `function ${name}(${argsCode}) {\n${stack}${returnValue ? `  return ${returnValue};\n` : ''}}\n`;
    };

    (javascriptGenerator as any).forBlock['procedures_callnoreturn'] = function(block: Blockly.Block) {
      const name = (javascriptGenerator as any).getVariableName(block.getFieldValue('NAME'));
      const args = [];
      const blockArgs = (block as any).arguments || [];
      for (let i = 0; i < blockArgs.length; i++) {
        args[i] = (javascriptGenerator as any).valueToCode(block, 'ARG' + i, (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      }
      return `${name}(${args.join(', ')});\n`;
    };

    (javascriptGenerator as any).forBlock['procedures_callreturn'] = function(block: Blockly.Block) {
      const name = (javascriptGenerator as any).getVariableName(block.getFieldValue('NAME'));
      const args = [];
      const blockArgs = (block as any).arguments || [];
      for (let i = 0; i < blockArgs.length; i++) {
        args[i] = (javascriptGenerator as any).valueToCode(block, 'ARG' + i, (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      }
      return [`${name}(${args.join(', ')})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['procedures_ifreturn'] = function(block: Blockly.Block) {
      const condition = (javascriptGenerator as any).valueToCode(block, 'CONDITION', (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      let code = `if (${condition}) {\n`;
      if ((block as any).hasReturnValue) {
        const value = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
        code += `  return ${value};\n`;
      } else {
        code += `  return;\n`;
      }
      code += '}\n';
      return code;
    };

    (javascriptGenerator as any).forBlock['lists_getIndex'] = function(block: Blockly.Block) {
      const mode = block.getFieldValue('MODE') || 'GET';
      const where = block.getFieldValue('WHERE') || 'FROM_START';
      const list = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      
      let code = '';
      if (mode === 'GET') {
        if (where === 'FROM_START') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}[${at} - 1]`;
        } else if (where === 'FROM_END') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}[${list}.length - ${at}]`;
        } else if (where === 'FIRST') {
          code = `${list}[0]`;
        } else if (where === 'LAST') {
          code = `${list}[${list}.length - 1]`;
        } else if (where === 'RANDOM') {
          code = `${list}[Math.floor(Math.random() * ${list}.length)]`;
        }
        return [code, (javascriptGenerator as any).ORDER_ATOMIC];
      } else if (mode === 'GET_REMOVE') {
        if (where === 'FROM_START') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}.splice(${at} - 1, 1)[0]`;
        } else if (where === 'FROM_END') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}.splice(${list}.length - ${at}, 1)[0]`;
        } else if (where === 'FIRST') {
          code = `${list}.shift()`;
        } else if (where === 'LAST') {
          code = `${list}.pop()`;
        } else if (where === 'RANDOM') {
          code = `(function(l){ const i = Math.floor(Math.random() * l.length); return l.splice(i, 1)[0]; })(${list})`;
        }
        return [code, (javascriptGenerator as any).ORDER_ATOMIC];
      } else if (mode === 'REMOVE') {
        if (where === 'FROM_START') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}.splice(${at} - 1, 1);\n`;
        } else if (where === 'FROM_END') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}.splice(${list}.length - ${at}, 1);\n`;
        } else if (where === 'FIRST') {
          code = `${list}.shift();\n`;
        } else if (where === 'LAST') {
          code = `${list}.pop();\n`;
        } else if (where === 'RANDOM') {
          code = `(function(l){ const i = Math.floor(Math.random() * l.length); l.splice(i, 1); })(${list});\n`;
        }
        return code;
      }
      return ['null', (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_setIndex'] = function(block: Blockly.Block) {
      const list = (javascriptGenerator as any).valueToCode(block, 'LIST', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const mode = block.getFieldValue('MODE');
      const where = block.getFieldValue('WHERE');
      const value = (javascriptGenerator as any).valueToCode(block, 'TO', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      
      let code = '';
      if (mode === 'SET') {
        if (where === 'FROM_START') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}[${at} - 1] = ${value};\n`;
        } else if (where === 'FROM_END') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}[${list}.length - ${at}] = ${value};\n`;
        } else if (where === 'FIRST') {
          code = `${list}[0] = ${value};\n`;
        } else if (where === 'LAST') {
          code = `${list}[${list}.length - 1] = ${value};\n`;
        } else if (where === 'RANDOM') {
          code = `${list}[Math.floor(Math.random() * ${list}.length)] = ${value};\n`;
        }
      } else if (mode === 'INSERT') {
        if (where === 'FROM_START') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}.splice(${at} - 1, 0, ${value});\n`;
        } else if (where === 'FROM_END') {
          const at = block.getInput('AT') ? (javascriptGenerator as any).valueToCode(block, 'AT', (javascriptGenerator as any).ORDER_ATOMIC) || '1' : '1';
          code = `${list}.splice(${list}.length - ${at}, 0, ${value});\n`;
        } else if (where === 'FIRST') {
          code = `${list}.unshift(${value});\n`;
        } else if (where === 'LAST') {
          code = `${list}.push(${value});\n`;
        } else if (where === 'RANDOM') {
          code = `${list}.splice(Math.floor(Math.random() * (${list}.length + 1)), 0, ${value});\n`;
        }
      }
      return code;
    };

    (javascriptGenerator as any).forBlock['lists_length'] = function(block: Blockly.Block) {
      const list = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      return [`${list}.length`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_create_empty'] = function() {
      return ['[]', (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_constant'] = function(block: Blockly.Block) {
      const constant = block.getFieldValue('CONSTANT');
      const map: any = { 'PI': 'Math.PI', 'E': 'Math.E', 'GOLDEN_RATIO': '(1 + Math.sqrt(5)) / 2', 'SQRT2': 'Math.SQRT2', 'SQRT1_2': 'Math.SQRT1_2', 'INFINITY': 'Infinity' };
      return [map[constant], (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_random_float'] = function() {
      return ['Math.random()', (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['sma_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return `${variable} = Bot.sma(${input}, ${period});\n`;
    };

    (javascriptGenerator as any).forBlock['ema_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      return `${variable} = Bot.ema(${input}, ${period});\n`;
    };

    (javascriptGenerator as any).forBlock['bb_statement'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const input = (javascriptGenerator as any).valueToCode(block, 'INPUT', (javascriptGenerator as any).ORDER_ATOMIC) || '[]';
      const period = (javascriptGenerator as any).valueToCode(block, 'PERIOD', (javascriptGenerator as any).ORDER_ATOMIC) || '14';
      const stdDev = (javascriptGenerator as any).valueToCode(block, 'UPPER', (javascriptGenerator as any).ORDER_ATOMIC) || '2';
      const field = block.getFieldValue('BB_FIELD');
      return `${variable} = Bot.bb(${input}, ${period}, ${stdDev}, '${field}');\n`;
    };

    (javascriptGenerator as any).forBlock['math_number'] = function(block: Blockly.Block) {
      const num = block.getFieldValue('NUM');
      return [num, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['text'] = function(block: Blockly.Block) {
      const text = block.getFieldValue('TEXT');
      return [`'${text}'`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['logic_boolean'] = function(block: Blockly.Block) {
      const bool = block.getFieldValue('BOOL') === 'TRUE';
      return [bool.toString(), (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_change'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VAR'));
      const delta = (javascriptGenerator as any).valueToCode(block, 'DELTA', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return `${variable} += ${delta};\n`;
    };

    (javascriptGenerator as any).forBlock['logic_ternary'] = function(block: Blockly.Block) {
      const condition = (javascriptGenerator as any).valueToCode(block, 'IF', (javascriptGenerator as any).ORDER_ATOMIC) || 'false';
      const thenValue = (javascriptGenerator as any).valueToCode(block, 'THEN', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      const elseValue = (javascriptGenerator as any).valueToCode(block, 'ELSE', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      return [`${condition} ? ${thenValue} : ${elseValue}`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_random_int'] = function(block: Blockly.Block) {
      const from = (javascriptGenerator as any).valueToCode(block, 'FROM', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const to = (javascriptGenerator as any).valueToCode(block, 'TO', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      return [`Math.floor(Math.random() * (${to} - ${from} + 1) + ${from})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_round'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const num = (javascriptGenerator as any).valueToCode(block, 'NUM', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const opMap: any = { 'ROUND': 'Math.round', 'ROUNDUP': 'Math.ceil', 'ROUNDDOWN': 'Math.floor' };
      return [`${opMap[op]}(${num})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_number_property'] = function(block: Blockly.Block) {
      const num = (javascriptGenerator as any).valueToCode(block, 'NUMBER_TO_CHECK', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const prop = block.getFieldValue('PROPERTY');
      let code = '';
      if (prop === 'EVEN') code = `${num} % 2 == 0`;
      else if (prop === 'ODD') code = `${num} % 2 != 0`;
      else if (prop === 'POSITIVE') code = `${num} > 0`;
      else if (prop === 'NEGATIVE') code = `${num} < 0`;
      else if (prop === 'WHOLE') code = `${num} % 1 == 0`;
      else if (prop === 'DIVISIBLE_BY') {
        const divisor = (javascriptGenerator as any).valueToCode(block, 'DIVISOR', (javascriptGenerator as any).ORDER_ATOMIC) || '1';
        code = `${num} % ${divisor} == 0`;
      }
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_single'] = function(block: Blockly.Block) {
      const op = block.getFieldValue('OP');
      const num = (javascriptGenerator as any).valueToCode(block, 'NUM', (javascriptGenerator as any).ORDER_ATOMIC) || '0';
      const opMap: any = { 'ROOT': 'Math.sqrt', 'ABS': 'Math.abs', 'NEG': '-', 'LN': 'Math.log', 'LOG10': 'Math.log10', 'EXP': 'Math.exp', 'POW10': 'Math.pow(10,' };
      let code = `${opMap[op]}(${num})`;
      if (op === 'NEG') code = `-${num}`;
      if (op === 'POW10') code = `Math.pow(10, ${num})`;
      return [code, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['lists_create_with'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      return `
        ${variable} = [];
        ${stack}
      `;
    };

    (javascriptGenerator as any).forBlock['text_join'] = function(block: Blockly.Block) {
      const variable = (javascriptGenerator as any).getVariableName(block.getFieldValue('VARIABLE'));
      const stack = (javascriptGenerator as any).statementToCode(block, 'STACK');
      return `
        ${variable} = '';
        ${stack}
      `;
    };

    (javascriptGenerator as any).forBlock['lists_statement'] = function(block: Blockly.Block) {
      const value = (javascriptGenerator as any).valueToCode(block, 'VALUE', (javascriptGenerator as any).ORDER_ATOMIC) || 'null';
      const parentBlock = block.getSurroundParent();
      if (parentBlock && parentBlock.type === 'lists_create_with') {
        const variable = (javascriptGenerator as any).getVariableName(parentBlock.getFieldValue('VARIABLE'));
        return `${variable}.push(${value});\n`;
      }
      return '';
    };

    (javascriptGenerator as any).forBlock['text_statement'] = function(block: Blockly.Block) {
      const text = (javascriptGenerator as any).valueToCode(block, 'TEXT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      const parentBlock = block.getSurroundParent();
      if (parentBlock && parentBlock.type === 'text_join') {
        const variable = (javascriptGenerator as any).getVariableName(parentBlock.getFieldValue('VARIABLE'));
        return `${variable} += ${text};\n`;
      }
      return `Bot.notify('info', ${text});\n`;
    };

    (javascriptGenerator as any).forBlock['virtual_trade_manager'] = function(block: any) {
      const losses = (javascriptGenerator as any).valueToCode(block, 'VIRTUAL_LOSSES', (javascriptGenerator as any).ORDER_ATOMIC) || "1";
      const real = (javascriptGenerator as any).valueToCode(block, 'REAL_TRADES', (javascriptGenerator as any).ORDER_ATOMIC) || "1";
      const afterRealLoss = (javascriptGenerator as any).valueToCode(block, 'LOSSES_AFTER_REAL_LOSS', (javascriptGenerator as any).ORDER_ATOMIC) || "1";
      const isSequenceOn = block.getFieldValue('SEQUENCE_SWITCH') === 'ON';
      const isContinuousOn = block.getFieldValue('CONTINUOUS_SWITCH') === 'ON';
      const isTickLossOn = block.getFieldValue('TICK_LOSS_SWITCH') === 'ON';

      if (isTickLossOn) {
        const tickLossCount = Number(block.getFieldValue('TICK_LOSS_COUNT')) || 3;
        const tickLossWindow = Number(block.getFieldValue('TICK_LOSS_WINDOW')) || 10;
        const tickLastResult = block.getFieldValue('TICK_LAST_RESULT') || 'loss';
        const tickLossConfigJson = JSON.stringify({
          enabled: true,
          countedLosses: tickLossCount,
          tickWindow: tickLossWindow,
          lastTradeResult: tickLastResult
        });
        return `Bot.setVirtualTradeConfig(${losses}, ${real}, ${afterRealLoss}, false, [], ${isContinuousOn}, ${tickLossConfigJson});\n`;
      }

      if (isSequenceOn) {
        const c1 = Number(block.getFieldValue('SEQ_1_COUNT')) || 0;
        const t1 = block.getFieldValue('SEQ_1_TYPE') || 'loss';
        const c2 = Number(block.getFieldValue('SEQ_2_COUNT')) || 0;
        const t2 = block.getFieldValue('SEQ_2_TYPE') || 'win';
        const c3 = Number(block.getFieldValue('SEQ_3_COUNT')) || 0;
        const t3 = block.getFieldValue('SEQ_3_TYPE') || 'loss';
        const stepsJson = JSON.stringify([
          { count: c1, type: t1 },
          { count: c2, type: t2 },
          { count: c3, type: t3 }
        ]);
        return `Bot.setVirtualTradeConfig(${losses}, ${real}, ${afterRealLoss}, true, ${stepsJson}, ${isContinuousOn});\n`;
      }
      return `Bot.setVirtualTradeConfig(${losses}, ${real}, ${afterRealLoss}, false, [], ${isContinuousOn});\n`;
    };

    (javascriptGenerator as any).forBlock['auto_stake'] = function(block: any) {
      const martingale = (javascriptGenerator as any).valueToCode(block, 'MARTINGALE', (javascriptGenerator as any).ORDER_ATOMIC) || "2";
      const fallback = (javascriptGenerator as any).valueToCode(block, 'FALLBACK', (javascriptGenerator as any).ORDER_ATOMIC) || "1";
      return `Bot.setAutoStakeConfig(${martingale}, ${fallback});\n`;
    };

    (javascriptGenerator as any).forBlock['text_print'] = function(block: Blockly.Block) {
      const text = (javascriptGenerator as any).valueToCode(block, 'TEXT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return `Bot.print(${text});\n`;
    };

    (javascriptGenerator as any).forBlock['text_prompt_ext'] = function(block: Blockly.Block) {
      const text = (javascriptGenerator as any).valueToCode(block, 'TEXT', (javascriptGenerator as any).ORDER_ATOMIC) || "''";
      return [`prompt(${text})`, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    (javascriptGenerator as any).forBlock['math_number_positive'] = function(block: Blockly.Block) {
      const num = block.getFieldValue('NUM');
      return [num, (javascriptGenerator as any).ORDER_ATOMIC];
    };

    Blockly.Blocks['controls_if_if'] = {
      init: function() {
        this.appendDummyInput().appendField("if");
        this.appendStatementInput("STACK");
        this.setColour(210);
        this.contextMenu = false;
      }
    };

    Blockly.Blocks['controls_if_elseif'] = {
      init: function() {
        this.appendDummyInput().appendField("else if");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
        this.contextMenu = false;
      }
    };

    Blockly.Blocks['controls_if_else'] = {
      init: function() {
        this.appendDummyInput().appendField("else");
        this.setPreviousStatement(true);
        this.setColour(210);
        this.contextMenu = false;
      }
    };

    Blockly.Blocks['controls_if'] = {
      init: function() {
        this.setStyle('logic_blocks');
        this.elseifCount_ = 0;
        this.elseCount_ = 0;
        this.updateShape_();
        this.setNextStatement(true);
        this.setPreviousStatement(true);
      },
      mutationToDom: function() {
        if (!this.elseifCount_ && !this.elseCount_) {
          return null;
        }
        const container = Blockly.utils.xml.createElement('mutation');
        if (this.elseifCount_) {
          container.setAttribute('elseif', this.elseifCount_);
        }
        if (this.elseCount_) {
          container.setAttribute('else', "1");
        }
        return container;
      },
      domToMutation: function(xmlElement: Element) {
        this.elseifCount_ = parseInt(xmlElement.getAttribute('elseif') || '0', 10);
        this.elseCount_ = parseInt(xmlElement.getAttribute('else') || '0', 10);
        this.updateShape_();
      },
      decompose: function(workspace: Blockly.Workspace) {
        const containerBlock = workspace.newBlock('controls_if_if');
        if ((containerBlock as any).initSvg) (containerBlock as any).initSvg();
        let connection = containerBlock.getInput('STACK').connection;
        for (let i = 1; i <= this.elseifCount_; i++) {
          const elseifBlock = workspace.newBlock('controls_if_elseif');
          if ((elseifBlock as any).initSvg) (elseifBlock as any).initSvg();
          connection.connect(elseifBlock.previousConnection);
          connection = elseifBlock.nextConnection;
        }
        if (this.elseCount_) {
          const elseBlock = workspace.newBlock('controls_if_else');
          if ((elseBlock as any).initSvg) (elseBlock as any).initSvg();
          connection.connect(elseBlock.previousConnection);
        }
        return containerBlock;
      },
      compose: function(containerBlock: Blockly.Block) {
        let clauseBlock = containerBlock.getInputTargetBlock('STACK');
        this.elseifCount_ = 0;
        this.elseCount_ = 0;
        const valueConnections = [null];
        const statementConnections = [null];
        let elseStatementConnection = null;
        while (clauseBlock) {
          switch (clauseBlock.type) {
            case 'controls_if_elseif':
              this.elseifCount_++;
              valueConnections.push((clauseBlock as any).valueConnection_);
              statementConnections.push((clauseBlock as any).statementConnection_);
              break;
            case 'controls_if_else':
              this.elseCount_++;
              elseStatementConnection = (clauseBlock as any).statementConnection_;
              break;
            default:
              throw new Error('Unknown block type: ' + clauseBlock.type);
          }
          clauseBlock = clauseBlock.nextConnection && clauseBlock.nextConnection.targetBlock();
        }
        this.updateShape_();
        // Reconnect any child blocks.
        for (let i = 1; i <= this.elseifCount_; i++) {
          (Blockly as any).icons.MutatorIcon.reconnect(valueConnections[i], this, 'IF' + i);
          (Blockly as any).icons.MutatorIcon.reconnect(statementConnections[i], this, 'DO' + i);
        }
        (Blockly as any).icons.MutatorIcon.reconnect(elseStatementConnection, this, 'ELSE');
      },
      saveConnections: function(containerBlock: Blockly.Block) {
        let clauseBlock = containerBlock.getInputTargetBlock('STACK');
        let i = 1;
        while (clauseBlock) {
          switch (clauseBlock.type) {
            case 'controls_if_elseif': {
              const inputIf = this.getInput('IF' + i);
              const inputDo = this.getInput('DO' + i);
              (clauseBlock as any).valueConnection_ = inputIf && inputIf.connection.targetConnection;
              (clauseBlock as any).statementConnection_ = inputDo && inputDo.connection.targetConnection;
              i++;
              break;
            }
            case 'controls_if_else': {
              const inputElse = this.getInput('ELSE');
              (clauseBlock as any).statementConnection_ = inputElse && inputElse.connection.targetConnection;
              break;
            }
            default:
              throw new Error('Unknown block type: ' + clauseBlock.type);
          }
          clauseBlock = clauseBlock.nextConnection && clauseBlock.nextConnection.targetBlock();
        }
      },
      updateShape_: function() {
        const block = this;
        // Delete everything except first IF
        if (this.getInput('ELSE')) this.removeInput('ELSE');
        let i = 1;
        while (this.getInput('IF' + i)) {
          this.removeInput('IF' + i);
          this.removeInput('DO' + i);
          i++;
        }
        // Remove minus buttons if they exist
        if (this.getInput('MINUS_INPUT')) this.removeInput('MINUS_INPUT');
        let j = 1;
        while (this.getInput('ELSEIF_MINUS' + j)) {
          this.removeInput('ELSEIF_MINUS' + j);
          j++;
        }
        if (this.getInput('ELSE_MINUS')) this.removeInput('ELSE_MINUS');
        // Remove plus button
        if (this.getInput('ADD')) this.removeInput('ADD');

        // Rebuild top part if not present
        if (!this.getInput('IF0')) {
            this.appendValueInput('IF0').setCheck('Boolean').appendField('if');
            this.appendStatementInput('DO0').appendField('then');
        }

        // Add ELSE IFs with MINUS buttons
        for (let k = 1; k <= this.elseifCount_; k++) {
          const m = this.appendValueInput('IF' + k).setCheck('Boolean');
          const minus = new (Blockly as any).FieldImage(MINUS_ICON, 14, 14, '-', () => {
            block.elseifCount_--;
            block.updateShape_();
          });
          m.appendField(minus).appendField('else if');
          this.appendStatementInput('DO' + k).appendField('then');
        }

        // Add ELSE with MINUS button
        if (this.elseCount_) {
          const m = this.appendStatementInput('ELSE');
          const minus = new (Blockly as any).FieldImage(MINUS_ICON, 14, 14, '-', () => {
            block.elseCount_ = 0;
            block.updateShape_();
          });
          m.appendField(minus).appendField('else');
        }

        // Add PLUS button at the bottom
        const addInput = this.appendDummyInput('ADD');
        const plus = new (Blockly as any).FieldImage(PLUS_ICON, 14, 14, '+', () => {
             // Choice: standard plus usually adds elseif
             // If we already have else, maybe just add another elseif before it? 
             // Or show a small menu? 
             // To match video as best as possible without complex custom fields: 
             // I'll show a small prompt or just cycle.
             // Actually, let's just add an elseif.
             block.elseifCount_++;
             block.updateShape_();
        });
        addInput.appendField(plus);
        
        // Add ELSE toggle if not present
        if (!this.elseCount_) {
            const addElse = new (Blockly as any).FieldImage(PLUS_ICON, 14, 14, '+', () => {
                block.elseCount_ = 1;
                block.updateShape_();
            });
            addInput.appendField(addElse);
        }
      }
    };

    // Define Custom Theme
    const theme = (Blockly as any).Theme.defineTheme('zelos_renderer-theme', {
      base: (Blockly as any).Themes?.Classic,
      blockStyles: {
        'trade_parameters': { colourPrimary: '#065f86' },
        'purchase_conditions': { colourPrimary: '#065f86' },
        'sell_conditions': { colourPrimary: '#065f86' },
        'restart_trading': { colourPrimary: '#065f86' },
        'analysis_blocks': { colourPrimary: '#9c27b0' },
        'logic_blocks': { colourPrimary: '#334771' },
        'math_blocks': { colourPrimary: '#334771' },
        'text_blocks': { colourPrimary: '#334771' },
        'list_blocks': { colourPrimary: '#334771' },
        'variable_blocks': { colourPrimary: '#334771' },
        'procedure_blocks': { colourPrimary: '#334771' },
      },
      categoryStyles: {},
      componentStyles: {
        workspaceBackgroundColour: '#0e0e0e',
        toolboxBackgroundColour: '#151717',
        toolboxTextColour: '#aaaaaa',
        flyoutBackgroundColour: '#151717',
        flyoutTextColour: '#aaaaaa',
        scrollbarColour: '#2d2f2f',
        insertionMarkerColour: '#ffffff',
        insertionMarkerOpacity: 0.3,
        scrollbarOpacity: 0.4,
        cursorColour: '#ffffff',
        fieldBackgroundColour: '#ffffff',
        fieldTextColour: '#000000',
      },
    });

    // Custom Constant Provider to make hexagonal blocks rounded
    if ((Blockly as any).zelos) {
      class CustomConstantProvider extends (Blockly as any).zelos.ConstantProvider {
        constructor() {
          super();
        }
        /** @override */
        init() {
          super.init();
        }
        /** @override */
        makeHexagonal() {
          return this.makeRounded();
        }
      }
      (Blockly as any).zelos.Renderer.prototype.makeConstants_ = function() {
        return new CustomConstantProvider();
      };
    }

    // Initialize Workspace
    workspace.current = Blockly.inject(blocklyDiv.current, {
      renderer: 'zelos',
      theme: theme,
      toolbox: `
        <xml xmlns="https://developers.google.com/blockly/xml">
          <category name="Trade parameters" colour="#ffc107">
            <block type="trade_definition"></block>
            <block type="virtual_trade_manager">
              <field name="SEQUENCE_SWITCH">OFF</field>
              <field name="CONTINUOUS_SWITCH">OFF</field>
              <field name="TICK_LOSS_SWITCH">OFF</field>
              <field name="TICK_LOSS_COUNT">3</field>
              <field name="TICK_LOSS_WINDOW">10</field>
              <field name="TICK_LAST_RESULT">loss</field>
              <value name="VIRTUAL_LOSSES">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="REAL_TRADES">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="LOSSES_AFTER_REAL_LOSS">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="auto_stake">
              <value name="MARTINGALE">
                <shadow type="math_number">
                  <field name="NUM">2</field>
                </shadow>
              </value>
              <value name="FALLBACK">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="trade_definition_market"></block>
            <block type="trade_definition_tradetype"></block>
            <block type="trade_definition_contracttype"></block>
            <block type="trade_definition_tradeoptions">
              <value name="DURATION">
                <shadow type="math_number">
                  <field name="NUM">5</field>
                </shadow>
              </value>
              <value name="AMOUNT">
                <shadow type="math_number">
                  <field name="NUM">0.35</field>
                </shadow>
              </value>
              <value name="PREDICTION">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="BARRIER">
                <shadow type="math_number">
                  <field name="NUM">0.5</field>
                </shadow>
              </value>
            </block>
            <block type="trade_definition_accumulator">
              <value name="AMOUNT">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
              <value name="TAKE_PROFIT">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="accu_tp_limit">
              <value name="PERCENT">
                <shadow type="math_number">
                  <field name="NUM">50</field>
                </shadow>
              </value>
            </block>
            <block type="no_of_runs">
              <value name="NO_OF_RUNS">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
            </block>
            <block type="trade_definition_switch_market"></block>
            <block type="scan_volatility_markets"></block>
            <block type="best_volatility_market"></block>
            <block type="rotate_volatility_market"></block>
            <block type="trade_definition_candleinterval"></block>
            <block type="trade_definition_restartbuysell"></block>
            <block type="trade_definition_restartonerror"></block>
          </category>
          <category name="Purchase conditions" colour="#4caf50">
            <block type="before_purchase"></block>
            <block type="scan_volatility_markets"></block>
            <block type="set_entry_armed"></block>
            <block type="is_entry_armed"></block>
            <block type="purchase"></block>
            <block type="purchase_dual"></block>
            <block type="purchase_over_under_dual">
              <value name="OVER_BARRIER">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="UNDER_BARRIER">
                <shadow type="math_number">
                  <field name="NUM">8</field>
                </shadow>
              </value>
            </block>
            <block type="purchase_dual_with_barriers">
              <value name="BARRIER1">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="BARRIER2">
                <shadow type="math_number">
                  <field name="NUM">8</field>
                </shadow>
              </value>
            </block>
            <block type="set_prediction_single">
              <value name="PREDICTION">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="set_prediction">
              <value name="PREDICTION">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="PREDICTION2">
                <shadow type="math_number">
                  <field name="NUM">8</field>
                </shadow>
              </value>
            </block>
            <block type="set_barrier_offset">
              <value name="BARRIER">
                <shadow type="math_number">
                  <field name="NUM">0.5</field>
                </shadow>
              </value>
            </block>
          </category>
          <category name="Sell conditions (optional)" colour="#f44336">
            <block type="during_purchase"></block>
            <block type="check_sell"></block>
            <block type="sell_at_market"></block>
            <block type="is_purchasing"></block>
            <block type="is_closed"></block>
          </category>
          <category name="Restart trading conditions" colour="#2196f3">
            <block type="after_purchase"></block>
            <block type="rotate_volatility_market"></block>
            <block type="scan_volatility_markets"></block>
            <block type="trade_again"></block>
            <block type="stop_bot"></block>
            <block type="contract_check_result"></block>
            <block type="is_purchasing"></block>
            <block type="is_closed"></block>
          </category>
          <category name="Analysis" colour="#9c27b0">
            <block type="tick_analysis"></block>
            <block type="scan_volatility_markets"></block>
            <block type="best_volatility_market"></block>
            <block type="check_digit_pattern_sequence"></block>
            <block type="set_entry_armed"></block>
            <block type="is_entry_armed"></block>
            <block type="consecutive_digits">
              <field name="COUNT">3</field>
            </block>
            <block type="last_digit"></block>
            <block type="last_digit_pattern"></block>
            <block type="digit_signal_pattern"></block>
            <block type="digit_pattern">
              <value name="SIGNAL">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="least_digit"></block>
            <block type="least_frequent_digit"></block>
            <block type="most_frequent_digit"></block>
            <block type="rise_fall_signal"></block>
            <block type="even_odd_signal"></block>
            <block type="over_under_signal"></block>
            <block type="differ_signal"></block>
            <block type="accumulator_signal"></block>
            <block type="accu_noise_calm_buy"></block>
            <block type="match_signal"></block>
            <block type="last_tick"></block>
            <block type="tick"></block>
            <block type="ticks"></block>
            <block type="ohlc"></block>
            <block type="read_ohlc"></block>
            <block type="get_ohlc"></block>
            <block type="check_direction"></block>
            <block type="direction"></block>
            <block type="balance"></block>
            <block type="total_profit"></block>
            <block type="total_runs"></block>
            <block type="total_win"></block>
            <block type="total_loss"></block>
            <block type="get_payout"></block>
            <block type="consecutive_loss_count"></block>
            <block type="read_details"></block>
            <block type="is_candle_black"></block>
          </category>
          <category name="Indicators" colour="#9c27b0">
            <block type="sma">
              <value name="PERIOD">
                <shadow type="math_number">
                  <field name="NUM">14</field>
                </shadow>
              </value>
            </block>
            <block type="ema">
              <value name="PERIOD">
                <shadow type="math_number">
                  <field name="NUM">14</field>
                </shadow>
              </value>
            </block>
            <block type="bb">
              <value name="PERIOD">
                <shadow type="math_number">
                  <field name="NUM">20</field>
                </shadow>
              </value>
              <value name="UPPER">
                <shadow type="math_number">
                  <field name="NUM">2</field>
                </shadow>
              </value>
            </block>
            <block type="rsi_statement"></block>
            <block type="input_list"></block>
            <block type="period">
              <value name="PERIOD">
                <shadow type="math_number">
                  <field name="NUM">14</field>
                </shadow>
              </value>
            </block>
          </category>
          <category name="Utility" colour="#4caf50">
            <block type="controls_if"></block>
            <block type="logic_compare"></block>
            <block type="logic_operation"></block>
          </category>
          <category name="Logic" colour="#4caf50">
            <block type="controls_if"></block>
            <block type="logic_compare"></block>
            <block type="logic_operation"></block>
            <block type="logic_negate"></block>
            <block type="logic_boolean"></block>
            <block type="logic_null"></block>
            <block type="logic_ternary"></block>
          </category>
          <category name="Math" colour="#4caf50">
            <block type="math_number"></block>
            <block type="math_number_positive"></block>
            <block type="math_arithmetic"></block>
            <block type="math_single"></block>
            <block type="math_round"></block>
            <block type="math_random_int">
              <value name="FROM">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="TO">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
            </block>
            <block type="math_number_property"></block>
            <block type="math_change">
              <value name="DELTA">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="math_constant"></block>
            <block type="math_random_float"></block>
            <block type="math_on_list"></block>
          </category>
          <category name="Text" colour="#4caf50">
            <block type="text"></block>
            <block type="text_join"></block>
            <block type="text_statement"></block>
            <block type="text_print"></block>
            <block type="text_prompt_ext"></block>
            <block type="notify">
              <value name="MESSAGE">
                <shadow type="text">
                  <field name="TEXT">abc</field>
                </shadow>
              </value>
            </block>
            <block type="totp_code"></block>
          </category>
          <category name="Lists" colour="#4caf50">
            <block type="lists_create_with"></block>
            <block type="lists_statement"></block>
            <block type="lists_getIndex"></block>
            <block type="lists_setIndex"></block>
            <block type="lists_length"></block>
            <block type="lists_create_empty"></block>
          </category>
          <category name="Variables" colour="#4caf50" custom="VARIABLE">
            <block type="variables_set"></block>
            <block type="variables_get"></block>
            <block type="is_replace_variable"></block>
          </category>
          <category name="Loops" colour="#4caf50">
            <block type="controls_whileUntil"></block>
            <block type="controls_for">
              <value name="FROM">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
              <value name="TO">
                <shadow type="math_number">
                  <field name="NUM">10</field>
                </shadow>
              </value>
              <value name="BY">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
            <block type="controls_forEach"></block>
            <block type="controls_flow_statements"></block>
            <block type="timeout">
              <value name="SECONDS">
                <shadow type="math_number">
                  <field name="NUM">1</field>
                </shadow>
              </value>
            </block>
          </category>
          <category name="Functions" colour="#4caf50" custom="PROCEDURE">
            <block type="procedures_defnoreturn"></block>
            <block type="procedures_defreturn"></block>
            <block type="procedures_callnoreturn"></block>
            <block type="procedures_callreturn"></block>
            <block type="procedures_ifreturn"></block>
            <block type="loader"></block>
          </category>
        </xml>
      `,
      trashcan: false,
      zoom: { controls: false, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 }
    });

    workspace.current.addChangeListener((e: any) => {
      if (e.type === Blockly.Events.UI && (e.element === 'category' || e.element === 'click')) {
        const toolbox = workspace.current?.getToolbox();
        if (toolbox && !toolbox.getSelectedItem()) {
          setActiveCategory(null);
        }
      }

      // Sync Market with Analysis Tool
      if (e.type === Blockly.Events.BLOCK_CHANGE || e.type === Blockly.Events.BLOCK_CREATE || e.type === Blockly.Events.BLOCK_MOVE) {
        const marketBlock = workspace.current?.getAllBlocks(false).find(b => b.type === 'trade_definition_market');
        if (marketBlock) {
          const symbol = marketBlock.getFieldValue('SYMBOL_LIST');
          if (symbol) {
            // Sync with analysis tool
            if (localStorage.getItem('analysis_symbol') !== symbol) {
              localStorage.setItem('analysis_symbol', symbol);
              window.dispatchEvent(new CustomEvent('analysis_market_sync', { detail: { symbol } }));
            }
            botEngine.getBotInterface().switchMarket(symbol);
          }
        }
      }
    });

    // Initial Strategy
    const initialXml = DEFAULT_STRATEGY_XML;
    
    const pendingXml = localStorage.getItem('pending_bot_xml');
    const pendingName = localStorage.getItem('pending_bot_name');
    
    const savedXml = pendingXml || localStorage.getItem('load_bot_xml') || localStorage.getItem(STORAGE_KEY);
    const savedInfo = pendingName ? JSON.stringify({ id: 'neural_bot', name: pendingName }) : localStorage.getItem('loaded_bot_info');

    if (pendingXml) {
       localStorage.removeItem('pending_bot_xml');
       localStorage.removeItem('pending_bot_name');
    }

    if (savedInfo) {
      try {
        setLoadedBotInfo(JSON.parse(savedInfo));
      } catch (e) {}
    }
    const finalInitialXml = savedXml || initialXml;
    console.log('[BotBuilder] Initializing workspace. Saved XML present:', !!savedXml);
    
    // Use a small timeout to ensure the workspace is fully ready before loading XML
    setTimeout(() => {
      try {
        const xmlText = finalInitialXml.trim();
        const xml = (Blockly as any).utils?.xml?.textToDom(xmlText) || (Blockly as any).Xml?.textToDom(xmlText);
        
        if (workspace.current && xml) {
          workspace.current.clear();
          
          // Ensure variables are created first
          const variables = xml.getElementsByTagName('variables')[0];
          if (variables) {
            Blockly.Xml.domToVariables(variables, workspace.current);
          }
          
          Blockly.Xml.domToWorkspace(xml, workspace.current);
          console.log('[BotBuilder] XML loaded into workspace successfully');
          
          // Force a re-render of all blocks and center the workspace
          setTimeout(() => {
            if (workspace.current) {
              workspace.current.getAllBlocks(false).forEach(block => {
                if (block.initSvg) block.initSvg();
                if (block.render) block.render();
              });
              Blockly.svgResize(workspace.current);
              workspace.current.scrollCenter();
              console.log('[BotBuilder] Workspace centered and blocks rendered');
              setIsWorkspaceLoading(false);
            }
          }, 100);
        } else {
          console.warn('[BotBuilder] Workspace or XML is null', { workspace: !!workspace.current, xml: !!xml });
          setIsWorkspaceLoading(false);
        }
      } catch (e) {
        console.error('[BotBuilder] Error loading bot XML:', e);
        setIsWorkspaceLoading(false);
      }
      
      if (savedXml) {
        localStorage.removeItem('load_bot_xml');
        localStorage.removeItem('load_bot_name');
      }
    }, 500);

    setWorkspaceInstance(workspace.current);

    // Hide the default Blockly toolbox sidebar permanently
    const toolboxDiv = blocklyDiv.current?.querySelector('.blocklyToolboxDiv') as HTMLElement;
    if (toolboxDiv) {
      toolboxDiv.style.display = 'none';
    }

    Blockly.svgResize(workspace.current);

    // Add workspace change listener to resolve loader blocks dynamically and persist workspace
    let saveTimeout: any;
    workspace.current.addChangeListener((event: any) => {
      // Persistence logic
      if (event.type === Blockly.Events.BLOCK_MOVE || 
          event.type === Blockly.Events.BLOCK_CHANGE || 
          event.type === Blockly.Events.BLOCK_CREATE || 
          event.type === Blockly.Events.BLOCK_DELETE ||
          event.type === Blockly.Events.VAR_CREATE ||
          event.type === Blockly.Events.VAR_DELETE ||
          event.type === Blockly.Events.VAR_RENAME) {
        
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          if (workspace.current) {
            const xml = Blockly.Xml.workspaceToDom(workspace.current);
            const xmlText = Blockly.Xml.domToText(xml);
            localStorage.setItem(STORAGE_KEY, xmlText);
          }
        }, 1000);
      }

      if (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.BLOCK_CHANGE) {
        const block = workspace.current?.getBlockById(event.blockId);
        if (block && block.type === 'loader') {
          const url = block.getFieldValue('URL');
          if (url && url.startsWith('http')) {
            fetch(url).then(res => res.text()).then(text => {
              const parser = new DOMParser();
              const subXmlDoc = parser.parseFromString(text, "text/xml");
              const subXml = subXmlDoc.documentElement;
              if (workspace.current) {
                Blockly.Xml.appendDomToWorkspace(subXml, workspace.current);
              }
            }).catch(err => console.error("Failed to load strategy:", err));
          }
        }
      }
    });

    return () => {
      workspace.current?.dispose();
    };
  }, []);

  const handleCategoryClick = (categoryName: string, index: number, isSubcategory = false) => {
    if (!workspace.current) return;

    const toolbox = workspace.current.getToolbox();
    if (!toolbox) return;

    // Toggle off if clicking the same category
    if (activeCategory === categoryName) {
      toolbox.clearSelection();
      setActiveCategory(null);
      return;
    }

    // Map our React sidebar indices to Blockly toolbox indices (flat list)
    let targetIndex = index;
    if (isSubcategory) {
      if (categoryName === 'Indicators') targetIndex = 5; 
      if (categoryName === 'Logic') targetIndex = 7; 
      if (categoryName === 'Math') targetIndex = 8;
      if (categoryName === 'Text') targetIndex = 9;
      if (categoryName === 'Lists') targetIndex = 10;
      if (categoryName === 'Variables') targetIndex = 11;
      if (categoryName === 'Loops') targetIndex = 12;
      if (categoryName === 'Functions') targetIndex = 13;
    } else {
      // Main categories
      if (categoryName === 'Trade parameters') targetIndex = 0;
      if (categoryName === 'Purchase conditions') targetIndex = 1;
      if (categoryName === 'Sell conditions (optional)') targetIndex = 2;
      if (categoryName === 'Restart trading conditions') targetIndex = 3;
      if (categoryName === 'Analysis') targetIndex = 4;
      if (categoryName === 'Utility') targetIndex = 6;
    }

    toolbox.selectItemByPosition(targetIndex);
    setActiveCategory(categoryName);
  };

  const toggleExpand = (label: string) => {
    setExpandedCategories(prev => 
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#0e0e0e] text-white overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <AnimatePresence>
          {isToolboxVisible && (
            <motion.aside 
              key="sidebar-toolbox"
              initial={isMobile ? { x: -64 } : { width: 0 }}
              animate={isMobile ? { x: 0 } : { width: 256 }}
              exit={isMobile ? { x: -64 } : { width: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                "border-r border-[#2d2f2f] bg-[#151717] flex flex-col shrink-0 z-[80] overflow-hidden shadow-2xl lg:shadow-none",
                "fixed inset-y-0 left-0 w-16 lg:w-64 lg:static lg:h-full"
              )}
            >
              <div className="p-2 lg:p-4 shrink-0">
                <div className="flex items-center justify-center mb-4 lg:hidden">
                  <button onClick={() => setIsToolboxVisible(false)} className="p-1 text-[#aaaaaa] hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <button 
                  onClick={handleQuickStrategy}
                  className="w-full bg-[#ff444f] hover:bg-[#ff444f]/90 text-white font-bold py-2 lg:py-2.5 rounded transition-colors mb-4 flex items-center justify-center shadow-md active:scale-95"
                >
                  <Zap size={18} className="lg:mr-2" />
                  <span className="hidden lg:inline">Quick strategy</span>
                </button>
                
                <div className="hidden lg:flex items-center justify-between text-sm font-bold mb-2 px-1 text-[#aaaaaa]">
                  <span>Blocks menu</span>
                  <ChevronRight size={16} className="rotate-90" />
                </div>

                <div className="relative mb-4 hidden lg:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaaaaa]" size={16} />
                  <input 
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0e0e0e] border border-[#2d2f2f] rounded py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#ff444f] transition-colors"
                  />
                </div>
              </div>

            <nav className="flex-1 overflow-y-auto custom-scrollbar">
              {[
                { label: 'Trade parameters', index: 0, icon: Layout },
                { label: 'Purchase conditions', index: 1, icon: Play },
                { label: 'Sell conditions (optional)', index: 2, icon: Square },
                { label: 'Restart trading conditions', index: 3, icon: RotateCcw },
                { 
                  label: 'Analysis', 
                  index: 4,
                  icon: LineChart,
                  subcategories: [
                    { label: 'Indicators', index: 0 }
                  ]
                },
                { 
                  label: 'Utility', 
                  index: 6,
                  icon: Package,
                  subcategories: [
                    { label: 'Logic', index: 0 },
                    { label: 'Math', index: 1 },
                    { label: 'Text', index: 2 },
                    { label: 'Lists', index: 3 },
                    { label: 'Variables', index: 4 },
                    { label: 'Loops', index: 5 },
                    { label: 'Functions', index: 6 },
                  ]
                },
              ].filter(item => 
                (item.label || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                (item.subcategories?.some(sub => (sub.label || '').toLowerCase().includes((searchQuery || '').toLowerCase())))
              ).map((item) => {
                const isExpanded = expandedCategories.includes(item.label);
                const hasSubcategories = !!item.subcategories;
                const Icon = item.icon;
                
                return (
                  <div key={item.label} className="border-b border-[#2d2f2f]/50">
                    <button 
                      onClick={() => {
                        handleCategoryClick(item.label, item.index);
                        if (hasSubcategories) {
                          toggleExpand(item.label);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-center lg:justify-between px-2 lg:px-4 py-3 text-sm transition-colors hover:bg-[#1a1c1c]",
                        activeCategory === item.label ? "text-white bg-[#1a1c1c]" : "text-[#aaaaaa] hover:text-white"
                      )}
                      title={item.label}
                    >
                      <div className="flex items-center">
                        <Icon size={18} className="lg:mr-3" />
                        <span className="hidden lg:inline truncate max-w-[140px]">{item.label}</span>
                      </div>
                      {hasSubcategories && (
                        <ChevronRight size={16} className={cn("hidden lg:block transition-transform", isExpanded && "rotate-90")} />
                      )}
                    </button>
                    
                    {hasSubcategories && isExpanded && (
                      <div className="bg-[#0e0e0e]/50 py-1 hidden lg:block">
                        {item.subcategories.map((sub, subIdx) => (
                          <button
                            key={sub.label}
                            onClick={() => handleCategoryClick(sub.label, subIdx, true)}
                            className={cn(
                              "w-full text-left px-10 py-2 text-xs transition-colors hover:text-white",
                              activeCategory === sub.label ? "text-white font-bold" : "text-[#888888]"
                            )}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Blocks Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isToolboxVisible && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[75] lg:hidden" 
            onClick={() => setIsToolboxVisible(false)}
          />
        )}
      </AnimatePresence>

        {/* Workspace Area */}
        <main className="flex-1 flex flex-col relative bg-[#0e0e0e] min-w-0">
          {/* Toolbar */}
          <div className="h-12 border-b border-[#2d2f2f] flex items-center px-2 lg:px-4 space-x-2 lg:space-x-4 bg-[#151717] shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center space-x-2 border-r border-[#2d2f2f] pr-2 lg:pr-4">
              <button 
                onClick={() => setIsToolboxVisible(!isToolboxVisible)}
                className={cn(
                  "flex items-center space-x-2 px-2 lg:px-3 py-1.5 rounded text-sm font-bold transition-colors",
                  isToolboxVisible ? "bg-[#ff444f] text-white" : "text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f]"
                )}
              >
                <Layout size={18} />
                <span className="hidden lg:inline">Blocks</span>
              </button>
              <button 
                onClick={() => setIsRunPanelOpen(!isRunPanelOpen)}
                className={cn(
                  "hidden md:flex items-center space-x-2 px-2 lg:px-3 py-1.5 rounded text-sm font-bold transition-colors",
                  isRunPanelOpen ? "bg-[#ff444f] text-white" : "text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f]"
                )}
              >
                <Activity size={18} />
                <span className="hidden lg:inline">Run Panel</span>
              </button>
            </div>

            <div className="flex items-center space-x-1 border-r border-[#2d2f2f] pr-2 lg:pr-4">
              <button 
                onClick={handleSaveWorkspace}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors" 
                title="Save"
              >
                <Save size={18} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors" 
                title="Import"
              >
                <FolderOpen size={18} />
              </button>
              <button 
                onClick={handleQuickStrategy}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors" 
                title="Quick Strategy"
              >
                <Zap size={18} />
              </button>
              <button 
                onClick={handleTutorial}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors hidden lg:block" 
                title="Tutorial"
              >
                <HelpCircle size={18} />
              </button>
            </div>

            <div className="flex items-center space-x-1">
              <button 
                onClick={handleZoomIn}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors" 
                title="Zoom In"
              >
                <Plus size={18} />
              </button>
              <button 
                onClick={handleZoomOut}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors" 
                title="Zoom Out"
              >
                <Minus size={18} />
              </button>
              <button 
                onClick={handleResetZoom}
                className="p-2 text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] rounded transition-colors" 
                title="Reset Zoom"
              >
                <RotateCcw size={18} />
              </button>
              <button 
                onClick={handleResetWorkspace}
                className="p-2 text-[#ff444f] hover:bg-[#ff444f]/10 rounded transition-colors" 
                title="Reset Workspace"
              >
                <RotateCw size={18} />
              </button>
            </div>
          </div>

          {isWorkspaceLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0e1117] bg-opacity-80 backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-[#00a79e] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-bold animate-pulse">Initializing Workspace...</p>
            <p className="text-[#888888] text-xs mt-2">Loading blocks and strategy...</p>
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <div 
            ref={blocklyDiv} 
            className={cn(
              "flex-1 w-full theme--dark", 
              activeCategory && "flyout-open",
              isMobile && !isRunPanelOpen && "pb-24"
            )} 
          />

          {/* Mobile Bottom Bar */}
          {isMobile && !isRunPanelOpen && !isAIAssistantOpen && (
            <div className="fixed bottom-0 left-0 right-0 z-[80] bg-[#0e0e0e] border-t border-[#2d2f2f] p-3 flex flex-col items-center gap-1 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
              <button 
                onClick={() => setIsRunPanelOpen(true)}
                className="text-[#aaaaaa] hover:text-white transition-colors p-1"
              >
                <ChevronUp size={24} />
              </button>
              <div className="flex w-full gap-2 items-center">
                <button
                  onClick={handleRunBot}
                  disabled={!rootStore.client.isConnected && !isBotRunning}
                  className={cn(
                    "flex items-center justify-center px-4 h-12 rounded font-bold text-sm transition-all min-w-[100px]",
                    isBotRunning ? "bg-[#ff444f] text-white" : "bg-[#00a79e] text-white",
                    !rootStore.client.isConnected && !isBotRunning && "opacity-40 grayscale cursor-not-allowed"
                  )}
                >
                  {isBotRunning ? <Square size={18} fill="currentColor" className="mr-2" /> : <Play size={18} fill="currentColor" className="mr-2" />}
                  <span>{isBotRunning ? 'Stop' : 'Run'}</span>
                </button>
                
                <div className="flex-1 h-12 border border-[#2d2f2f] rounded bg-[#151717] flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-[11px] text-white font-black z-10 uppercase tracking-widest">
                    {botStatus}
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-[#00a79e]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <AnimatePresence>
          {isSaveModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#151717] w-full max-w-md rounded-lg overflow-hidden border border-[#2d2f2f] shadow-2xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-[#2d2f2f]">
                  <h2 className="text-white font-bold text-lg">Save strategy</h2>
                  <button 
                    onClick={() => setIsSaveModalOpen(false)}
                    className="text-[#aaaaaa] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  <p className="text-[#aaaaaa] text-sm leading-relaxed">
                    Enter your bot name, choose to save on your computer or Google Drive, and hit <span className="font-bold text-white">Save</span>.
                  </p>
                  
                  <div className="space-y-2">
                    <div className={cn(
                      "relative rounded border transition-all duration-200",
                      showNameError ? "border-[#ff444f]" : "border-[#2d2f2f] focus-within:border-[#00a79e]"
                    )}>
                      <input
                        type="text"
                        value={botName}
                        onChange={(e) => {
                          setBotName(e.target.value);
                          if (e.target.value.trim()) setShowNameError(false);
                        }}
                        placeholder="Bot name"
                        className="w-full bg-transparent p-3 text-white outline-none placeholder:text-[#555555]"
                        autoFocus
                      />
                    </div>
                    {showNameError && (
                      <p className="text-[#ff444f] text-xs">Strategy name cannot be empty</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSaveLocation('local')}
                      className={cn(
                        "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200 space-y-3",
                        saveLocation === 'local' 
                          ? "border-[#00a79e] bg-[#00a79e]/5" 
                          : "border-[#2d2f2f] hover:border-[#3d3f3f] text-[#555555]"
                      )}
                    >
                      <div className={cn(
                        "w-16 h-12 flex items-center justify-center rounded bg-[#0e1117]",
                        saveLocation === 'local' ? "text-[#00a79e]" : "text-[#555555]"
                      )}>
                        <Monitor size={32} />
                      </div>
                      <span className={cn(
                        "font-bold text-sm",
                        saveLocation === 'local' ? "text-white" : "text-[#555555]"
                      )}>Local</span>
                    </button>
                    
                    <button
                      onClick={() => setSaveLocation('ready_bots')}
                      className={cn(
                        "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200 space-y-3",
                        saveLocation === 'ready_bots' 
                          ? "border-[#00a79e] bg-[#00a79e]/5" 
                          : "border-[#2d2f2f] hover:border-[#3d3f3f] text-[#555555]"
                      )}
                    >
                      <div className={cn(
                        "w-16 h-12 flex items-center justify-center rounded bg-[#0e1117]",
                        saveLocation === 'ready_bots' ? "text-[#00a79e]" : "text-[#555555]"
                      )}>
                        <Zap size={32} />
                      </div>
                      <span className={cn(
                        "font-bold text-sm",
                        saveLocation === 'ready_bots' ? "text-white" : "text-[#555555]"
                      )}>Ready Bots</span>
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-[#0e1117] flex justify-end space-x-3">
                  <button
                    onClick={() => setIsSaveModalOpen(false)}
                    className="px-6 py-2 rounded border border-[#2d2f2f] text-white font-bold hover:bg-[#2d2f2f] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSave}
                    className="px-8 py-2 rounded bg-[#ff444f] text-white font-bold hover:bg-[#ff444f]/90 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {isVariableModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#151717] w-full max-w-md rounded-lg overflow-hidden border border-[#2d2f2f] shadow-2xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-[#2d2f2f]">
                  <h2 className="text-white font-bold text-lg">New variable</h2>
                  <button 
                    onClick={cancelVariableCreation}
                    className="text-[#aaaaaa] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  <p className="text-[#aaaaaa] text-sm leading-relaxed">
                    Enter the name for your new variable.
                  </p>
                  
                  <div className="space-y-2">
                    <div className="relative rounded border border-[#2d2f2f] focus-within:border-[#00a79e] transition-all duration-200">
                      <input
                        type="text"
                        value={newVariableName}
                        onChange={(e) => setNewVariableName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmVariableCreation();
                          if (e.key === 'Escape') cancelVariableCreation();
                        }}
                        placeholder="Variable name"
                        className="w-full bg-transparent p-3 text-white outline-none placeholder:text-[#555555]"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-[#0e1117] flex justify-end space-x-3">
                  <button
                    onClick={cancelVariableCreation}
                    className="px-6 py-2 rounded border border-[#2d2f2f] text-white font-bold hover:bg-[#2d2f2f] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmVariableCreation}
                    className="px-8 py-2 rounded bg-[#ff444f] text-white font-bold hover:bg-[#ff444f]/90 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {isQuickStrategyModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#151717] w-full max-w-lg rounded-xl overflow-hidden border border-[#2d2f2f] shadow-2xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-[#2d2f2f] bg-[#121414]">
                  <div className="flex items-center space-x-2">
                    <Zap className="text-[#ff444f]" size={20} />
                    <h2 className="text-white font-bold text-lg">Quick Strategy Templates</h2>
                  </div>
                  <button 
                    onClick={() => setIsQuickStrategyModalOpen(false)}
                    className="text-[#aaaaaa] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                  <p className="text-[#aaaaaa] text-xs leading-relaxed">
                    Select a ready-to-run strategy to instantly build on your workspace.
                  </p>

                  {/* Volatility Scanner & Digit Pattern Strategy */}
                  <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 hover:border-purple-500/60 transition-all space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">⚡ Volatility 10 (1s) to 100 Multi-Market Scanner</span>
                          <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-bold">
                            NEW
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Digit pattern-matching & sequence-based statistical strategy built for Deriv's synthetic indices:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-black/40 p-2.5 rounded-lg border border-[#2a2d3d]">
                      <div>
                        <span className="text-amber-400 font-bold block">1. Market Scanner</span>
                        <span className="text-slate-400 text-[10px]">Scans Vol 10 (1s) to 100 for highest statistical win rate.</span>
                      </div>
                      <div>
                        <span className="text-purple-300 font-bold block">2. Digit Sequence</span>
                        <span className="text-slate-400 text-[10px]">Differs 9 → Under 9 → Under 8 with State-Based Arming.</span>
                      </div>
                      <div>
                        <span className="text-emerald-400 font-bold block">3. Market Rotation</span>
                        <span className="text-slate-400 text-[10px]">Shifts to next synthetic index after win.</span>
                      </div>
                    </div>

                    <button
                      onClick={() => loadStrategyTemplate('pattern_scanning')}
                      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Zap size={15} />
                      Load Volatility Scanner & Digit Pattern Strategy
                    </button>
                  </div>

                  {/* Higher / Lower Strategy */}
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:border-amber-500/60 transition-all space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">📈 Higher / Lower (Barrier Offset) Strategy</span>
                          <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                            NEW SPEC
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Predict if market price ends strictly higher or lower than the target Barrier. Equal exit spot is considered a loss per Deriv rules.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-black/40 p-2.5 rounded-lg border border-[#3d2f1f]">
                      <div>
                        <span className="text-amber-400 font-bold block">1. Target Barrier</span>
                        <span className="text-slate-400 text-[10px]">Offset +0.37 above entry price.</span>
                      </div>
                      <div>
                        <span className="text-emerald-400 font-bold block">2. 5-Tick Duration</span>
                        <span className="text-slate-400 text-[10px]">Deriv API compliant minimum duration.</span>
                      </div>
                      <div>
                        <span className="text-cyan-400 font-bold block">3. Strict Evaluation</span>
                        <span className="text-slate-400 text-[10px]">Higher wins strictly above, Lower below.</span>
                      </div>
                    </div>

                    <button
                      onClick={() => loadStrategyTemplate('higher_lower')}
                      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Zap size={15} />
                      Load Higher / Lower Strategy
                    </button>
                  </div>

                  {/* Standard Default Rise/Fall Strategy */}
                  <div className="p-4 rounded-xl border border-[#2d2f2f] bg-[#121414] hover:border-[#3d3f3f] transition-all space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold text-white">Standard Default Rise / Fall Strategy</span>
                        <p className="text-xs text-[#888888] mt-1">
                          Classic baseline bot with basic Rise/Fall execution on Volatility 10 (1s).
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => loadStrategyTemplate('default')}
                      className="w-full py-2.5 rounded-lg bg-[#2d2f2f] hover:bg-[#3d3f3f] text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      Load Standard Default Strategy
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-[#0e1117] flex justify-end">
                  <button
                    onClick={() => setIsQuickStrategyModalOpen(false)}
                    className="px-6 py-2 rounded border border-[#2d2f2f] text-white font-bold hover:bg-[#2d2f2f] transition-colors text-xs"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileImport} 
            accept=".xml" 
            className="hidden" 
          />

          {/* Mobile Run Panel Toggle - Hidden in favor of new bottom bar */}
          <div className="hidden lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
            <button
              onClick={() => setIsRunPanelOpen(true)}
              className={cn(
                "text-white px-8 py-3 rounded-full font-bold shadow-lg flex items-center space-x-3 active:scale-95 transition-all duration-300",
                isBotRunning ? "bg-[#00a79e] shadow-[0_8px_30px_rgb(0,167,158,0.4)]" : "bg-[#ff444f] shadow-[0_8px_30px_rgb(255,68,79,0.4)]"
              )}
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                {isBotRunning ? (
                  <Activity size={18} className="animate-pulse" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </div>
              <span className="text-sm tracking-wide uppercase">
                {isBotRunning ? (
                  <span className="flex items-center space-x-2">
                    <span className="text-green-300">Win: {stats.contractsWon}</span>
                    <span className="opacity-50">/</span>
                    <span className="text-red-300">Lost: {stats.contractsLost}</span>
                  </span>
                ) : (
                  "Run Panel"
                )}
              </span>
            </button>
          </div>
        </main>

        {/* Right Sidebar (RunPanel) */}
        <AnimatePresence>
          {isRunPanelOpen && (
            <motion.aside 
              key="sidebar-run-panel"
              initial={isMobile ? { y: '100%' } : { width: 0 }}
              animate={isMobile ? { y: 0 } : { width: 320 }}
              exit={isMobile ? { y: '100%' } : { width: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                "border-[#2d2f2f] bg-[#151717] flex flex-col shrink-0 relative overflow-hidden",
                "fixed inset-0 z-[90] lg:static lg:h-full lg:border-l shadow-2xl lg:shadow-none"
              )}
            >
              {/* Header section */}
              {isMobile ? (
                <div className="flex items-center justify-between h-14 border-b border-[#2d2f2f] bg-[#0e0e0e] px-4 shrink-0 transition-all duration-300">
                  <div className="flex items-center space-x-2">
                    <img src="/ai.png" alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                    <span className="text-lg font-bold title-shine">OTIVO AI</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {rootStore.client.isConnected && (
                        rootStore.client.accountType === 'demo' ? (
                          <div className="w-5 h-5 flex items-center justify-center">
                            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                              <circle cx="100" cy="100" r="90" fill="#89A9AD" />
                              <g fill="none" stroke="#FFFFFF" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="80" y1="50" x2="80" y2="150" />
                                <path d="M65,50 H110 C155,50 155,150 110,150 H65" />
                                <line x1="65" y1="83" x2="110" y2="83" />
                                <line x1="65" y1="117" x2="110" y2="117" />
                              </g>
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full overflow-hidden border border-[#2d2f2f] flex items-center justify-center bg-white">
                            <img 
                              src="https://flagcdn.com/w80/us.png" 
                              alt="USA" 
                              className="w-full h-full object-cover scale-125"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )
                      )}
                        <div className="flex flex-col items-end leading-none">
                          <div className="flex items-center space-x-2 mb-1">
                            {getActiveAccountType() === 'demo' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsDemoResetModalOpen(true);
                                }}
                                className="text-[8px] bg-[#2d2f2f] hover:bg-[#3d3f3f] text-[#aaaaaa] hover:text-white px-1.5 py-0.5 rounded transition-colors uppercase font-black"
                              >
                                Reset
                              </button>
                            )}
                            <span className="text-[9px] text-[#888888] uppercase font-black opacity-70">Balance</span>
                          </div>
                          {((rootStore.client.isConnecting || !rootStore.client.isConnected) && !isBotRunning) ? (
                            <div className="balance-skeleton" style={{ width: '80px', height: '12px' }} />
                          ) : (
                            <span className="text-sm font-bold text-[#00a79e]">
                              {isBotRunning 
                                ? stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : rootStore.client.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              } {rootStore.client.currency || (isBotRunning ? 'USD' : '')}
                            </span>
                          )}
                        </div>
                    </div>
                    <button 
                      onClick={() => setIsRunPanelOpen(false)}
                      className="p-1 text-[#aaaaaa] hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Drag Handle (Hidden on Desktop) */}
                  <div className="lg:hidden h-10 flex items-center justify-center cursor-pointer group" onClick={() => setIsRunPanelOpen(false)}>
                    <div className="w-12 h-1.5 bg-[#2d2f2f] group-hover:bg-[#3d3f3f] rounded-full transition-colors" />
                  </div>

                  {/* RunPanelHeader (Desktop) */}
                  <div className="flex items-center h-14 border-b border-[#2d2f2f] bg-[#0e0e0e] p-2 space-x-2">
                    <button
                      onClick={handleRunBot}
                      disabled={!rootStore.client.isConnected && !isBotRunning}
                      className={cn(
                        "flex items-center justify-center px-4 h-10 rounded font-bold text-sm transition-all min-w-[100px]",
                        isBotRunning ? "bg-[#ff444f] text-white" : "bg-[#00a79e] text-white",
                        !rootStore.client.isConnected && !isBotRunning && "opacity-40 grayscale cursor-not-allowed"
                      )}
                    >
                      {isBotRunning ? <Square size={16} fill="currentColor" className="mr-2" /> : <Play size={16} fill="currentColor" className="mr-2" />}
                      <span>{isBotRunning ? 'Stop' : 'Run'}</span>
                    </button>
                    <div className="flex-1 h-10 border border-[#2d2f2f] rounded bg-[#0e0e0e] flex flex-col items-center justify-center relative overflow-hidden group">
                      <div className="flex items-center space-x-2 z-10">
                        <span 
                          className={cn(
                            "text-[11px] text-white font-black flex items-center tracking-[0.1em] uppercase transition-all duration-300",
                            isBotRunning && "opacity-90"
                          )}
                          style={{
                            textShadow: '1.5px 0 #ff444f, -1.5px 0 #00a79e'
                          }}
                        >
                          {botStatus}
                        </span>
                      </div>
                      
                      {isBotRunning && (
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#1a1c1c]">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full bg-[#00a79e] relative"
                          >
                            {progress > 0 && progress < 100 && (
                              <motion.div 
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#ff444f] rounded-full shadow-[0_0_10px_rgba(255,68,79,0.8)] z-20" 
                              />
                            )}
                          </motion.div>
                        </div>
                      )}
                    </div>
                    {/* Mobile Close Button (Hidden on Desktop) */}
                    <button 
                      onClick={() => setIsRunPanelOpen(false)}
                      className="lg:hidden p-2 text-[#aaaaaa] hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </>
              )}

          {/* RunPanel Tabs */}
          <div className="flex border-b border-[#2d2f2f] h-12 bg-[#151717]">
            {[
              { id: 'summary', label: 'Summary' },
              { id: 'analysis', label: 'Analysis' },
              { id: 'transactions', label: 'Transactions' },
              { id: 'journal', label: 'Journal' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center text-sm font-bold transition-colors relative",
                  activeTab === tab.id 
                    ? "text-white" 
                    : "text-[#aaaaaa] hover:text-white"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#ff444f]" />
                )}
              </button>
            ))}
          </div>

          {/* RunPanel Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#151717]">
            {activeTab === 'summary' && (
              <div className="p-4 space-y-4">
                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f]">
                  <h4 className="text-xs font-bold text-[#aaaaaa] mb-3 uppercase tracking-wider">Account Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-[#888888]">Active Market</span>
                      <span className="text-xs font-bold text-white">{analysis.symbolName || 'Loading...'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#888888]">Total Runs</span>
                      <span className="text-xs font-bold text-white">{stats.totalRuns}</span>
                    </div>
                    <div className="flex justify-between items-center h-4">
                      <span className="text-xs text-[#888888]">Trading Mode</span>
                      <div className="flex items-center gap-1.5">
                        {botEngine.isContinuousTradingActive() && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Continuous Real Trading after signal is active">
                            CONT AFTER SIGNAL
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                          botEngine.getBotInterface().getVirtualMode() === 'virtual' ? "bg-[#818cf8]/20 text-[#818cf8]" : "bg-[#ff444f]/20 text-[#ff444f]"
                        )}>
                          {botEngine.getBotInterface().getVirtualMode()}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center h-4">
                      <span className="text-xs text-[#888888]">Current Balance</span>
                      <div className="flex items-center space-x-2">
                        {getActiveAccountType() === 'demo' && (
                          <button 
                            onClick={() => setIsDemoResetModalOpen(true)}
                            className="text-[10px] bg-[#2d2f2f] hover:bg-[#3d3f3f] text-[#aaaaaa] hover:text-white px-2 py-0.5 rounded transition-colors"
                          >
                            Reset
                          </button>
                        )}
                        {((rootStore.client.isConnecting || !rootStore.client.isConnected) && !isBotRunning) ? (
                          <div className="h-3 w-16 bg-[#1f2121] rounded relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.25)] to-transparent bg-[length:200%_100%] animate-[moveShimmer_1.5s_infinite_linear]" />
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-white">{Number(stats.balance || 0).toFixed(2)} {rootStore.client.currency || 'USD'}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#888888]">Total Profit/Loss</span>
                        <button
                          type="button"
                          onClick={() => {
                            botEngine.resetStats();
                          }}
                          title="Clear Total Profit & Stats"
                          className="p-0.5 text-[#888888] hover:text-[#ff444f] transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <span className={cn(
                        "text-xs font-bold",
                        stats.totalProfit > 0 ? "text-[#00a79e]" : stats.totalProfit < 0 ? "text-[#ff444f]" : "text-white"
                      )}>
                        {Number(stats.totalProfit || 0).toFixed(2)} USD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#888888]">Total Payout</span>
                      <span className="text-xs font-bold text-white">
                        {Number(stats.totalPayout || 0).toFixed(2)} USD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#888888]">Win Rate</span>
                      <span className="text-xs font-bold text-white">
                        {stats.totalRuns > 0 ? ((stats.contractsWon / stats.totalRuns) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f]">
                  <h4 className="text-xs font-bold text-[#aaaaaa] mb-3 uppercase tracking-wider">Trade Limits</h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#888888] uppercase font-bold">Take Profit (USD)</label>
                      <input
                        type="number"
                        value={isNaN(takeProfit) ? '' : takeProfit}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTakeProfit(isNaN(val) ? 0 : val);
                        }}
                        className="w-full bg-[#151717] border border-[#2d2f2f] rounded p-2 text-xs text-white outline-none focus:border-[#00a79e] transition-colors"
                        disabled={isBotRunning}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#888888] uppercase font-bold">Stop Loss (USD)</label>
                      <input
                        type="number"
                        value={isNaN(stopLoss) ? '' : stopLoss}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setStopLoss(isNaN(val) ? 0 : val);
                        }}
                        className="w-full bg-[#151717] border border-[#2d2f2f] rounded p-2 text-xs text-white outline-none focus:border-[#ff444f] transition-colors"
                        disabled={isBotRunning}
                      />
                    </div>
                    <p className="text-[9px] text-[#555555] italic">
                      Bot will automatically stop when these limits are reached.
                    </p>
                  </div>
                </div>
                
                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f]">
                  <h4 className="text-xs font-bold text-[#aaaaaa] mb-3 uppercase tracking-wider">Last Contract</h4>
                  {transactions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-[#888888]">Result</span>
                        <span className={cn("text-xs font-bold", transactions[0].result === 'win' ? "text-[#00a79e]" : "text-[#ff444f]")}>
                          {transactions[0].result.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-[#888888]">Profit</span>
                        <span className={cn("text-xs font-bold", transactions[0].profit >= 0 ? "text-[#00a79e]" : "text-[#ff444f]")}>
                          {Number(transactions[0].profit || 0).toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#555] italic">No contracts yet</p>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'analysis' && (
              <div className="p-4 space-y-4">
                {/* Auto Reset & Start After Take Profit */}
                <div className={cn(
                  "p-3.5 rounded-xl border flex flex-col gap-3 transition-all",
                  autoRestartAfterTp ? "border-emerald-500/40 bg-emerald-950/20 shadow-lg shadow-emerald-500/5" : "bg-[#0e0e0e] border-[#2d2f2f]"
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isBotRunning}
                        onClick={() => {
                          if (!isBotRunning && activeSessionProfit !== 0) {
                            handleResetSessionProfit();
                          }
                        }}
                        className={cn(
                          "w-8.5 h-8.5 rounded-lg flex items-center justify-center border shrink-0 transition-all",
                          autoRestartAfterTp ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-[#141622] border-[#292c3d] text-slate-400",
                          !isBotRunning && activeSessionProfit !== 0 ? "cursor-pointer hover:border-emerald-400 hover:text-white" : ""
                        )}
                        title={!isBotRunning && activeSessionProfit !== 0 ? "Click to reset session profit counter" : undefined}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-white">Auto Reset & Start After Take Profit</span>
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase",
                            autoRestartAfterTp ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-400"
                          )}>
                            {autoRestartAfterTp ? 'ENABLED' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          When Take Profit is hit, automatically click reset (<RotateCcw size={10} className="inline text-slate-300" />) & auto-restart until the Auto Start Overall Take Profit Limit is reached
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBotRunning}
                      onClick={() => setAutoRestartAfterTp(!autoRestartAfterTp)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
                        autoRestartAfterTp ? "bg-emerald-500" : "bg-zinc-700"
                      )}
                      title="Auto reset stats and auto start bot when Take Profit is hit"
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5",
                          autoRestartAfterTp ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Dedicated Auto Start Take Profit Input */}
                  <div className="pt-2 border-t border-[#2d2f2f] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                        <Target size={13} className="text-emerald-400" />
                        <span>Auto Start Overall Take Profit Limit ($ USD):</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[10px] font-mono font-semibold",
                          activeSessionProfit > 0 ? "text-emerald-300" :
                          activeSessionProfit < 0 ? "text-rose-400" :
                          "text-slate-300"
                        )}>
                          Current Session: {activeSessionProfit >= 0 ? `+$${activeSessionProfit.toFixed(2)}` : `-$${Math.abs(activeSessionProfit).toFixed(2)}`} / ${autoRestartMaxTp.toFixed(2)} USD
                        </span>
                        {activeSessionProfit !== 0 && !isBotRunning && (
                          <button
                            type="button"
                            onClick={handleResetSessionProfit}
                            title="Reset current session profit to $0.00"
                            className="text-[9px] font-mono text-slate-500 hover:text-slate-300 underline cursor-pointer transition-colors"
                          >
                            (Reset)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">$</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          disabled={isBotRunning}
                          value={autoRestartMaxTp}
                          onChange={(e) => setAutoRestartMaxTp(Math.max(1, parseFloat(e.target.value) || 50.0))}
                          className="w-full pl-6 pr-3 py-1.5 bg-[#12141f] border border-[#232638] rounded-lg text-xs font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
                          placeholder="50.00"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        {[20, 50, 100, 200].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            disabled={isBotRunning}
                            onClick={() => setAutoRestartMaxTp(preset)}
                            className={cn(
                              "px-2 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all disabled:opacity-50 cursor-pointer",
                              autoRestartMaxTp === preset
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold"
                                : "bg-[#141622] border-[#292c3d] text-slate-400 hover:text-white"
                            )}
                          >
                            +${preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                      <span>When total session profit hits +${autoRestartMaxTp.toFixed(2)} USD, the Auto Start switch turns OFF automatically and the bot stops.</span>
                    </div>
                  </div>
                </div>

                {/* REAL-TIME SCHEDULED ALARMS CARD */}
                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f] space-y-3 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className={cn("w-4 h-4", isAlarmSchedulerEnabled ? "text-[#ff444f] animate-pulse" : "text-slate-500")} />
                      <span className="text-xs font-bold text-[#aaaaaa] uppercase tracking-wider">
                        Real-Time Alarm Scheduler
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAlarmSchedulerEnabled ? (
                        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                          {currentTimeStr || '00:00:00'}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          Off
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !isAlarmSchedulerEnabled;
                          setIsAlarmSchedulerEnabled(nextState);
                          botEngine.getBotInterface().notify('info', `Real-Time Alarm Scheduler ${nextState ? 'ACTIVATED' : 'DEACTIVATED'}`);
                        }}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          isAlarmSchedulerEnabled ? "bg-[#ff444f]" : "bg-[#2d2f2f]"
                        )}
                        title={isAlarmSchedulerEnabled ? "Deactivate and hide Alarm Scheduler" : "Activate and show Alarm Scheduler"}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            isAlarmSchedulerEnabled ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* DROPPED / EXPANDED SECTION (Shown ONLY when switch is ON) */}
                  {isAlarmSchedulerEnabled && (
                    <div className="space-y-3 pt-2 border-t border-[#2d2f2f]">
                      <p className="text-[10px] text-[#888888] leading-normal">
                        Set exact times for Bot Builder to automatically start running. Multiple alarms can be added.
                      </p>

                      {/* Form to add new alarm */}
                      <form onSubmit={handleAddAlarm} className="space-y-2 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-[#aaaaaa]">
                              Time
                            </label>
                            <input
                              type="time"
                              step="1"
                              value={newAlarmTime}
                              onChange={(e) => setNewAlarmTime(e.target.value)}
                              className="w-full bg-[#151717] border border-[#2d2f2f] text-white text-xs font-mono font-bold rounded px-2.5 py-1.5 outline-none focus:border-[#ff444f] transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-[#aaaaaa]">
                              Label
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Morning Strategy"
                              value={newAlarmLabel}
                              onChange={(e) => setNewAlarmLabel(e.target.value)}
                              className="w-full bg-[#151717] border border-[#2d2f2f] text-white text-xs font-bold rounded px-2.5 py-1.5 outline-none focus:border-[#ff444f] transition-all"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-[#ff444f]/10 hover:bg-[#ff444f]/20 border border-[#ff444f]/30 text-[#ff444f] font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} />
                          Add Alarm Schedule
                        </button>
                      </form>

                      {/* Alarm List */}
                      <div className="space-y-1.5 pt-2 border-t border-[#2d2f2f] max-h-[180px] overflow-y-auto custom-scrollbar">
                        {alarms.length === 0 ? (
                          <div className="text-center py-2 text-[10px] text-[#555555] italic">
                            No alarms set. Set a time above to schedule automated runs.
                          </div>
                        ) : (
                          alarms.map(alarm => (
                            <div
                              key={alarm.id}
                              className={cn(
                                "flex items-center justify-between p-2 rounded border text-xs transition-all",
                                alarm.enabled 
                                  ? "bg-[#151717] border-[#2d2f2f] text-white" 
                                  : "bg-[#0e0e0e] border-[#222428] text-slate-500 opacity-60"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Clock size={14} className={alarm.enabled ? "text-[#ff444f] shrink-0" : "text-slate-600 shrink-0"} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-white text-xs">{alarm.time}</span>
                                    {alarm.enabled ? (
                                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase">
                                        Active
                                      </span>
                                    ) : (
                                      <span className="text-[8px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-bold uppercase">
                                        Off
                                      </span>
                                    )}
                                  </div>
                                  {alarm.label && (
                                    <div className="text-[9px] text-[#888888] truncate">{alarm.label}</div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAlarm(alarm.id)}
                                  className={cn(
                                    "px-2 py-1 text-[9px] font-bold uppercase rounded border transition-all cursor-pointer",
                                    alarm.enabled
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                      : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white"
                                  )}
                                  title={alarm.enabled ? "Disable Alarm" : "Enable Alarm"}
                                >
                                  {alarm.enabled ? "ON" : "OFF"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAlarm(alarm.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                                  title="Delete Alarm"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Auto Reset after Stop Option inside Real-Time Alarm Scheduler */}
                      <div className="pt-2 border-t border-[#2d2f2f]">
                        <div className="flex items-center justify-between p-2.5 bg-[#151717] rounded border border-[#2d2f2f]">
                          <div className="flex items-center gap-2.5">
                            <RefreshCw size={14} className={cn("shrink-0", isAutoResetEnabled ? "text-[#ff444f] animate-spin-slow" : "text-slate-500")} />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                                Auto Reset after Stop
                              </span>
                              <span className="text-[9px] text-[#888888] leading-tight">
                                Automatically presses Reset & Ok to clear stats & journal when bot stops
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !isAutoResetEnabled;
                              setIsAutoResetEnabled(next);
                              botEngine.getBotInterface().notify('info', `Auto Reset ${next ? 'ACTIVATED' : 'DEACTIVATED'}`);
                            }}
                            className={cn(
                              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              isAutoResetEnabled ? "bg-[#ff444f]" : "bg-[#2d2f2f]"
                            )}
                            title={isAutoResetEnabled ? "Disable Auto Reset after Stop" : "Enable Auto Reset after Stop"}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                isAutoResetEnabled ? "translate-x-4" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f]">
                  <h4 className="text-xs font-bold text-[#aaaaaa] mb-3 uppercase tracking-wider">Tick Analysis</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#888888]">Symbol</span>
                      <div className="flex items-center space-x-2">
                         <div className="scale-75 origin-right">
                           <MarketLogo symbol={analysis.symbolName || ''} />
                         </div>
                         <span className="text-xs font-bold text-white">{analysis.symbolName || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#888888]">Pip Size</span>
                      <span className="text-xs font-bold text-white">{analysis.pipSize || '0.01'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#888888]">Last Tick</span>
                      <span className="text-xs font-bold text-[#00a79e]">{analysis.lastTick || '0.00'}</span>
                    </div>
                    {analysis.high_barrier && (
                      <div className="flex justify-between items-center border-t border-[#2d2f2f] pt-2 mt-2">
                        <span className="text-[11px] text-[#888888]">Upper Barrier</span>
                        <span className="text-xs font-bold text-[#ff444f]">{Number(analysis.high_barrier || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {analysis.low_barrier && (
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#888888]">Lower Barrier</span>
                        <span className="text-xs font-bold text-[#ff444f]">{Number(analysis.low_barrier || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#888888]">Last Digit</span>
                      <div className="w-8 h-8 rounded-full bg-[#2d2f2f] flex items-center justify-center border border-[#ff444f]/30">
                        <span className="text-sm font-bold text-[#ff444f]">{analysis.lastDigit ?? '-'}</span>
                      </div>
                    </div>
                    
                    {analysis.signals && (() => {
                      const sigs = analysis.signals;
                      const activeSymbol = analysis.symbolName || (botEngine as any).tradeParams?.symbol || '';
                      const rawDigits = (botEngine as any).digits || [];
                      const rawTicks = (botEngine as any).ticks || [];

                      const multiMarketSignals = getAllMarketDifferSignals();
                      const differSig = multiMarketSignals[activeSymbol] || sigs.differ || (rawDigits.length > 0 ? computeDiffersSignal(rawDigits, activeSymbol) : null);
                      const ouSig = sigs.over_under_details || (rawDigits.length > 0 ? computeOverUnderSignal(rawDigits, activeSymbol, 4, 4) : null);
                      const accuSig = sigs.accumulator || (rawTicks.length > 0 ? computeAccumulatorSignal(rawTicks, (botEngine as any).ohlc || [], activeSymbol) : null);
                      const accuNoiseSig = sigs.accu_noise || (rawTicks.length > 0 ? computeAccuNoiseSignal(rawTicks, activeSymbol) : null);

                      return (
                        <div className="space-y-2.5 pt-3 border-t border-[#2d2f2f] mt-2">
                          {/* Section Header */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#aaaaaa] uppercase tracking-wider">Analysis Tool Signals</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-[#00a79e]/15 text-[#00a79e] border border-[#00a79e]/30">Live Sync</span>
                          </div>

                          {/* Over/Under Direction Summary Signal */}
                          <div className="p-2.5 rounded-lg bg-[#141617] border border-[#262829] space-y-1.5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-1.5">
                                <Compass className="w-3.5 h-3.5 text-[#00a79e]" />
                                <span className="text-[10px] text-white font-bold uppercase tracking-wider">Over / Under</span>
                              </div>
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded font-mono",
                                (ouSig?.direction === 'OVER' || sigs.over_under === 'BUY OVER 1') ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                (ouSig?.direction === 'UNDER' || sigs.over_under === 'BUY UNDER 8') ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                                "bg-[#2d2f2f] text-[#888888]"
                              )}>
                                {ouSig?.direction === 'OVER' ? 'BUY OVER 1' : ouSig?.direction === 'UNDER' ? 'BUY UNDER 8' : (sigs.over_under || 'NEUTRAL')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-[#777777] font-mono pt-1 border-t border-[#222425]">
                              <span>O: {ouSig?.overPressure ?? 0}% | U: {ouSig?.underPressure ?? 0}%</span>
                              <span className="text-[#00a79e] font-semibold">Net: {ouSig?.netConfidence ?? 0}%</span>
                            </div>
                          </div>

                          {/* Differ Signal: 2, 3 & 5. Missing & Overdue Gaps */}
                          <div className="p-2.5 rounded-lg bg-[#141617] border border-[#262829] space-y-1.5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-1.5">
                                <Target className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[10px] text-white font-bold uppercase tracking-wider">Differs (2, 3 & 5 Gaps)</span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                {differSig?.isOverdue && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                                    Overdue
                                  </span>
                                )}
                                {differSig?.isMissing && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                                    Missing
                                  </span>
                                )}
                                <span className="text-[10px] font-black px-2 py-0.5 rounded font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Avoid {differSig?.prediction ?? sigs.differ_digit ?? '-'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-[#777777] font-mono pt-1 border-t border-[#222425]">
                              <span>Gap: <span className="text-purple-300 font-bold">{differSig?.gap ?? sigs.differ_gap ?? 0} ticks</span></span>
                              <span className="text-emerald-400 font-semibold">{differSig?.winRate ?? sigs.differ_win_rate ?? 90}% Win Rate</span>
                            </div>
                          </div>

                          {/* Accumulator Signal: AMFE Direction Summary & 50/50 % Neutral Trigger */}
                          <div className="p-2.5 rounded-lg bg-[#141617] border border-[#262829] space-y-1.5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] text-white font-bold uppercase tracking-wider">Accumulator</span>
                              </div>
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded font-mono",
                                (accuSig?.isNeutral5050 || sigs.is_neutral_5050)
                                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 animate-pulse"
                                  : "bg-[#2d2f2f] text-slate-400"
                              )}>
                                {(accuSig?.isNeutral5050 || sigs.is_neutral_5050) ? 'BUY ACCU (50/50 Neutral)' : 'STAND BY'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-[#777777] font-mono pt-1 border-t border-[#222425]">
                              <span>Up: {accuSig?.upPressure ?? 0}% | Down: {accuSig?.downPressure ?? 0}%</span>
                              <span className={cn(
                                "font-bold",
                                (accuSig?.isNeutral5050 || sigs.is_neutral_5050) ? "text-emerald-400" : "text-amber-400"
                              )}>
                                Neutral: {accuSig?.sliderPos ?? 50}%
                              </span>
                            </div>
                          </div>

                          {/* ACCU NOISE: CALM BUY */}
                          {accuNoiseSig && (
                            <div className="p-2.5 rounded-lg bg-[#141617] border border-[#262829] space-y-1.5">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-1.5">
                                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                  <span className="text-[10px] text-white font-bold uppercase tracking-wider">ACCU NOISE</span>
                                </div>
                                <span className={cn(
                                  "text-[10px] font-black px-2 py-0.5 rounded font-mono",
                                  accuNoiseSig.signal === 'BUY_ACCU'
                                    ? "bg-indigo-500/25 text-indigo-300 border border-indigo-500/50 animate-pulse"
                                    : "bg-[#2d2f2f] text-slate-400"
                                )}>
                                  {accuNoiseSig.signal === 'BUY_ACCU' ? 'CALM BUY' : 'NOISY'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-[#777777] font-mono pt-1 border-t border-[#222425]">
                                <span>Noise Score: {accuNoiseSig.noiseScore} (Target ≤ 30)</span>
                                <span className={cn(
                                  "font-bold",
                                  accuNoiseSig.signal === 'BUY_ACCU' ? "text-indigo-400" : "text-amber-400"
                                )}>
                                  Calm: {accuNoiseSig.calmness}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Classic Signals: Trend & Even/Odd & Frequencies */}
                          <div className="pt-2 border-t border-[#222425] space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#888888] uppercase font-bold">Trend Signal</span>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded",
                                sigs.rise_fall === 'RISE' ? "bg-[#00a79e]/20 text-[#00a79e]" :
                                sigs.rise_fall === 'FALL' ? "bg-[#ff444f]/20 text-[#ff444f]" : "bg-[#2d2f2f] text-[#aaaaaa]"
                              )}>
                                {sigs.rise_fall}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#888888] uppercase font-bold">Even/Odd Balance</span>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded",
                                sigs.even_odd === 'EVEN' ? "bg-[#00a79e]/20 text-[#00a79e]" :
                                sigs.even_odd === 'ODD' ? "bg-[#ff444f]/20 text-[#ff444f]" : "bg-[#2d2f2f] text-[#aaaaaa]"
                              )}>
                                {sigs.even_odd}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#888888] uppercase font-bold">Most Frequent Digit</span>
                              <span className="text-xs font-bold text-white bg-[#2d2f2f] w-6 h-6 flex items-center justify-center rounded-full">
                                {sigs.most_frequent}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-[#888888] uppercase font-bold">Least Frequent Digit</span>
                              <span className="text-xs font-bold text-white bg-[#ff444f]/20 w-6 h-6 flex items-center justify-center rounded-full border border-[#ff444f]/30">
                                {sigs.least_frequent}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f]">
                  <h4 className="text-xs font-bold text-[#aaaaaa] mb-4 uppercase tracking-wider">Digit Distribution (Last 1000)</h4>
                  <div className="grid grid-cols-5 gap-y-6 gap-x-2 mt-2 pb-2">
                    {analysis.digitStats ? (() => {
                      const total = analysis.digitStats.reduce((a: number, b: number) => a + b, 0);
                      const sortedStats = [...analysis.digitStats].map((c: number, i: number) => ({ digit: i, count: c })).sort((a: any, b: any) => a.count - b.count);
                      const leastDigit = sortedStats[0].digit;
                      const secondLeastDigit = sortedStats[1].digit;
                      const mostDigit = sortedStats[9].digit;
                      const secondMostDigit = sortedStats[8].digit;
                      
                      return analysis.digitStats.map((count: number, digit: number) => {
                        const percentage = total > 0 ? (count / total) * 100 : 0;
                        
                        const isLeast = digit === leastDigit;
                        const isSecondLeast = digit === secondLeastDigit;
                        const isMost = digit === mostDigit;
                        const isSecondMost = digit === secondMostDigit;
                        
                        const isLatest = analysis.lastDigit === digit;

                        return (
                          <div key={digit} className="flex flex-col items-center relative">
                            <div className={cn(
                              "w-12 h-12 rounded-full border-[2.5px] flex flex-col items-center justify-center bg-[#111213] transition-colors relative z-10 shadow-lg",
                              isLeast ? "border-[#ff444f]" :
                              isSecondLeast ? "border-[#f59e0b]" :
                              isMost ? "border-[#00a79e]" :
                              isSecondMost ? "border-[#3b82f6]" :
                              "border-[#2d2f2f]"
                            )}>
                              <span className="text-[13px] font-black text-white leading-none">
                                {digit}
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-medium leading-none mt-1">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                            {isLatest && (
                              <motion.div 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute -bottom-4 text-[#ff444f] text-[10px]"
                              >
                                ▲
                              </motion.div>
                            )}
                          </div>
                        );
                      });
                    })() : (
                      <div className="col-span-5 text-center py-4 text-[#555] text-xs italic">
                        Waiting for tick data...
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#0e0e0e] p-4 rounded border border-[#2d2f2f]">
                  <h4 className="text-xs font-bold text-[#aaaaaa] mb-3 uppercase tracking-wider">Recent Ticks</h4>
                  <div className="h-24 flex items-end space-x-0.5">
                    {analysis.ticks && (() => {
                      // Only render up to the last 100 ticks for the visual bar chart to prevent DOM bloat
                      const displayTicks = analysis.ticks.slice(-100);
                      if (displayTicks.length === 0) return null;
                      const min = Math.min(...displayTicks);
                      const max = Math.max(...displayTicks);
                      const range = max - min;
                      return displayTicks.map((tick: number, i: number) => {
                        const height = range > 0 ? ((tick - min) / range) * 100 : 50;
                        
                        return (
                          <div 
                            key={i} 
                            className="flex-1 bg-[#00a79e]/30 hover:bg-[#00a79e] transition-colors rounded-t-sm"
                            style={{ height: `${Math.max(5, height)}%` }}
                            title={tick.toString()}
                          />
                        );
                      });
                    })()}
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] text-[#555]">{analysis.ticks?.[0]?.toFixed(2)}</span>
                    <span className="text-[9px] text-[#555]">{analysis.ticks?.[analysis.ticks.length - 1]?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'transactions' && (
              <div className="flex flex-col h-full">
                <div className="p-4 flex justify-between items-center bg-[#151717]/50 border-b border-[#2d2f2f]">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        const data = JSON.stringify(transactions, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `transactions-${new Date().getTime()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center space-x-2 px-3 py-1.5 border border-[#2d2f2f] rounded text-[10px] font-bold text-[#aaaaaa] hover:text-white hover:bg-[#2d2f2f] transition-colors"
                    >
                      <Download size={12} />
                      <span>Export All</span>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-[#aaaaaa] border-b border-[#2d2f2f]">
                  <span>Type</span>
                  <span className="text-center">Entry/Exit spot</span>
                  <span className="text-right">Buy price and P/L</span>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <AnimatePresence initial={false}>
                    {(() => {
                      const sessionTxs = transactions.filter(t => t.timestamp >= botEngine.sessionStartTime).slice(0, 50);
                      if (sessionTxs.length === 0) return (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
                          <Package size={64} className="text-[#2d2f2f] mb-4" />
                          <h3 className="text-sm font-bold text-[#aaaaaa] mb-2">There are no transactions to display</h3>
                          <p className="text-xs text-[#555]">Here are the possible reasons:</p>
                          <ul className="text-xs text-[#555] list-disc list-inside mt-2">
                            <li>The bot is not running</li>
                            <li>The stats are cleared</li>
                          </ul>
                        </div>
                      );

                      // Group by batchId
                      const items: (Transaction | Transaction[])[] = [];
                      const batchMap = new Map<string, Transaction[]>();

                      sessionTxs.forEach(tx => {
                        if (tx.batchId) {
                          if (!batchMap.has(tx.batchId)) {
                            const batch = [tx];
                            batchMap.set(tx.batchId, batch);
                            items.push(batch);
                          } else {
                            batchMap.get(tx.batchId)!.push(tx);
                          }
                        } else {
                          items.push(tx);
                        }
                      });

                      return items.map((item) => {
                        const isBatch = Array.isArray(item);
                        const firstTx = isBatch ? item[0] : item;
                        const itemId = (isBatch ? firstTx.batchId : firstTx.id) || firstTx.timestamp;

                        if (isBatch) {
                          const totalBatchProfit = item.reduce((sum, tx) => sum + tx.profit, 0);
                          const allFinished = item.every(tx => tx.result !== 'pending');
                          
                          return (
                            <motion.div 
                              key={itemId}
                              initial={{ x: 320, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              className="border-b border-[#2d2f2f]/30"
                            >
                              <div className="px-3 py-1 flex items-center justify-between bg-[#1a1c1c]/80 border-y border-[#2d2f2f]/20 group">
                                <div className="flex items-center space-x-2">
                                  <div className="flex -space-x-1 items-center">
                                    <Layers size={10} className="text-[#00a79e] relative z-10" />
                                    <Layers size={10} className="text-[#00a79e] opacity-40 translate-x-0.5 translate-y-0.5" />
                                  </div>
                                  <span className="text-[9px] font-black text-[#00a79e] uppercase tracking-tighter">Synced Dual Order</span>
                                </div>
                                {allFinished ? (
                                  <div className={cn(
                                    "flex items-center space-x-1.5",
                                    totalBatchProfit >= 0 ? "text-[#00a79e]" : "text-[#ff444f]"
                                  )}>
                                    <span className="text-[8px] font-bold uppercase opacity-50">Combined:</span>
                                    <span className="text-[11px] font-black tracking-tight">
                                      {totalBatchProfit >= 0 ? '+' : ''}{Number(totalBatchProfit || 0).toFixed(2)}
                                      <span className="text-[8px] ml-0.5 opacity-70">USD</span>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1.5">
                                    <div className="flex space-x-0.5">
                                      <div className="w-1 h-1 rounded-full bg-[#00a79e] animate-ping" />
                                      <div className="w-1 h-1 rounded-full bg-[#00a79e] animate-ping delay-75" />
                                    </div>
                                    <span className="text-[8px] font-black text-[#00a79e] uppercase animate-pulse">Purchasing...</span>
                                  </div>
                                )}
                              </div>
                              {item.map((tx) => (
                                <TransactionRow key={tx.id || tx.timestamp} tx={tx} isSubRow={true} legIndex={item.indexOf(tx)} />
                              ))}
                            </motion.div>
                          );
                        }

                        return (
                          <motion.div 
                            key={itemId}
                            initial={{ x: 320, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -320, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          >
                            <TransactionRow tx={item} />
                          </motion.div>
                        );
                      });
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {activeTab === 'journal' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {journal.length > 0 ? (
                    journal.slice(0, 100).map((msg, idx) => (
                      <div key={`${msg.timestamp}-${idx}`} className="text-[11px] p-2 rounded bg-[#0e0e0e] border-l-2 border-[#2d2f2f]" style={{ borderLeftColor: msg.type === 'error' ? '#ff444f' : msg.type === 'success' ? '#00a79e' : msg.type === 'warn' ? '#ffc107' : '#2196F3' }}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[9px] text-[#555]">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          <span className="text-[9px] uppercase font-bold opacity-70">{msg.type}</span>
                        </div>
                        <p className="text-white">{msg.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-[#aaaaaa] text-sm">
                      Journal is empty.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats Footer */}
          <div className="p-4 border-t border-[#2d2f2f] bg-[#0e0e0e]">
            <div className="flex justify-end mb-2">
              <button className="text-[10px] text-[#aaaaaa] hover:text-white underline decoration-dotted">What's this?</button>
            </div>
            <div className="grid grid-cols-3 gap-y-4 mb-6">
              <div className="text-center">
                <p className="text-[11px] text-[#aaaaaa] font-bold mb-1">Total stake</p>
                <p className="text-xs font-bold text-white">{Number(stats.totalStake || 0).toFixed(2)} USD</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[#aaaaaa] font-bold mb-1">Total payout</p>
                <p className="text-xs font-bold text-white">{Number(stats.totalPayout || 0).toFixed(2)} USD</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[#aaaaaa] font-bold mb-1">No. of runs</p>
                <p className="text-xs font-bold text-white">{stats.totalRuns}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[#aaaaaa] font-bold mb-1">Contracts lost</p>
                <p className="text-xs font-bold text-white">{stats.contractsLost}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[#aaaaaa] font-bold mb-1">Contracts won</p>
                <p className="text-xs font-bold text-white">{stats.contractsWon}</p>
              </div>
              <div className="text-center relative group">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-[11px] text-[#aaaaaa] font-bold">Total profit/loss</p>
                  <button
                    type="button"
                    onClick={() => {
                      botEngine.resetStats();
                    }}
                    title="Clear Total Profit & Stats"
                    className="p-0.5 text-[#aaaaaa] hover:text-[#ff444f] transition-colors cursor-pointer"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <p className={cn(
                  "text-xs font-bold",
                  stats.totalProfit > 0 ? "text-[#00a79e]" : stats.totalProfit < 0 ? "text-[#ff444f]" : "text-white"
                )}>
                  {Number(stats.totalProfit || 0).toFixed(2)} USD
                </p>
              </div>
            </div>

            {/* Auto Reset Quick Switch on Run Panel */}
            <div className="flex items-center justify-between mb-2 px-2.5 py-1.5 bg-[#151717] rounded border border-[#2d2f2f]">
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", isAutoResetEnabled ? "bg-[#00a79e] animate-pulse" : "bg-slate-600")} />
                <span className="text-[10px] font-bold text-[#aaaaaa] uppercase tracking-wider">
                  Auto Reset on Stop
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !isAutoResetEnabled;
                  setIsAutoResetEnabled(next);
                  botEngine.getBotInterface().notify('info', `Auto Reset on Stop ${next ? 'ACTIVATED' : 'DEACTIVATED'}`);
                }}
                className={cn(
                  "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isAutoResetEnabled ? "bg-[#ff444f]" : "bg-[#2d2f2f]"
                )}
                title="Automatically trigger Reset & Ok dialog when bot stops"
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isAutoResetEnabled ? "translate-x-3" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            <button 
              onClick={() => {
                clearAutoResetTimers();
                setIsAutoConfirmingReset(false);
                setIsResetModalOpen(true);
              }}
              disabled={isBotRunning}
              className={cn(
                "w-full border border-[#2d2f2f] text-white font-bold py-2 rounded transition-colors text-sm",
                isBotRunning ? "opacity-50 cursor-not-allowed" : "hover:bg-[#2d2f2f]"
              )}
            >
              Reset
            </button>
          </div>

          {/* Mobile Run Controls Footer */}
          {isMobile && (
            <div className="p-4 bg-[#0e0e0e] border-t border-[#2d2f2f] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] shrink-0">
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleRunBot}
                  disabled={!rootStore.client.isConnected && !isBotRunning}
                  className={cn(
                    "flex items-center justify-center h-12 px-8 rounded-lg font-black text-base transition-all",
                    isBotRunning ? "bg-[#ff444f] text-white" : "bg-[#00a79e] text-white",
                    (!rootStore.client.isConnected && !isBotRunning) && "opacity-40 grayscale cursor-not-allowed"
                  )}
                >
                  {isBotRunning ? <Square size={18} fill="currentColor" className="mr-2" /> : <Play size={18} fill="currentColor" className="mr-2" />}
                  <span>{isBotRunning ? 'Stop' : 'Run'}</span>
                </button>
                
                <div className="flex-1 h-12 border border-[#2d2f2f] rounded-lg bg-[#151717] flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-[11px] text-white font-black z-10 uppercase tracking-widest px-2 text-center truncate">
                    {botStatus}
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-[#00a79e]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Reset Stats Confirmation Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => {
                clearAutoResetTimers();
                setIsResetModalOpen(false);
              }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#151717] border border-[#2d2f2f] rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white">Are you sure?</h3>
                  <button 
                    onClick={() => {
                      clearAutoResetTimers();
                      setIsResetModalOpen(false);
                    }}
                    className="text-[#aaaaaa] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-[#aaaaaa] leading-relaxed mb-6">
                  This will clear all data in the summary, transactions, and journal panels. All counters will be reset to zero, while Digit Distribution (Last 1000) history is preserved.
                </p>

                {isAutoConfirmingReset && (
                  <div className="flex items-center gap-2 text-xs text-[#ff444f] font-bold mb-6 bg-[#ff444f]/10 border border-[#ff444f]/30 px-3 py-2 rounded-md animate-pulse">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Auto Reset: Pressing Ok automatically...</span>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      clearAutoResetTimers();
                      setIsResetModalOpen(false);
                    }}
                    className="px-6 py-2 rounded border border-[#2d2f2f] text-white font-bold text-sm hover:bg-[#2d2f2f] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      clearAutoResetTimers();
                      rootStore.run_panel.clearStat();
                      setPrintMessage(null);
                      setIsResetModalOpen(false);
                    }}
                    className={cn(
                      "px-8 py-2 rounded bg-[#ff444f] text-white font-bold text-sm hover:bg-[#ff444f]/90 transition-all flex items-center gap-2",
                      isAutoConfirmingReset && "ring-2 ring-white ring-offset-2 ring-offset-[#151717] scale-105 shadow-[0_0_20px_rgba(255,68,79,0.6)]"
                    )}
                  >
                    {isAutoConfirmingReset && <RefreshCw size={14} className="animate-spin" />}
                    <span>Ok</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Demo Balance Confirmation Modal */}
      <AnimatePresence>
        {isDemoResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsDemoResetModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#151717] border border-[#2d2f2f] rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white">Reset Demo Balance?</h3>
                  <button 
                    onClick={() => setIsDemoResetModalOpen(false)}
                    className="text-[#aaaaaa] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-[#aaaaaa] leading-relaxed mb-8">
                  This will reset your demo account balance to its initial amount. Are you sure you want to proceed?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsDemoResetModalOpen(false)}
                    className="px-6 py-2 rounded border border-[#2d2f2f] text-white font-bold text-sm hover:bg-[#2d2f2f] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const accountType = getActiveAccountType();
                      const connectionType = localStorage.getItem('deriv_connection_type') || 'oauth';
                      
                      if (accountType === 'demo') {
                        if (connectionType === 'oauth') {
                          const accountId = getActiveAccountId();
                          const token = getActiveToken();
                          if (accountId?.startsWith('DOT') && token) {
                            await botEngine.resetDemoBalance(accountId, token);
                          }
                        } else {
                          botEngine.send({ topup_virtual: 1 });
                        }
                      }
                      setIsDemoResetModalOpen(false);
                    }}
                    className="px-8 py-2 rounded bg-[#ff444f] text-white font-bold text-sm hover:bg-[#ff444f]/90 transition-colors"
                  >
                    Reset Balance
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Workspace Reset Confirmation Modal */}
      <AnimatePresence>
        {isWorkspaceResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsWorkspaceResetModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-[400px] bg-[#151717] border border-[#2d2f2f] rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-white">Are you sure?</h3>
                  <button 
                    onClick={() => setIsWorkspaceResetModalOpen(false)}
                    className="p-1 text-[#aaaaaa] hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-[#999999] text-base mb-8">
                  Any unsaved changes will be lost.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsWorkspaceResetModalOpen(false)}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-[#3e3e3e] text-white font-bold text-sm hover:bg-[#2d2f2f] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmResetWorkspace}
                    className="flex-1 sm:flex-none px-8 py-2.5 rounded-lg bg-[#ff444f] text-white font-bold text-sm hover:bg-[#ff444f]/90 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isRunPanelOpen && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[85]" 
            onClick={() => setIsRunPanelOpen(false)}
          />
        )}
      </AnimatePresence>
      <AIAssistant 
        workspace={workspaceInstance} 
        isOpen={isAIAssistantOpen} 
        setIsOpen={setIsAIAssistantOpen} 
      />

      {/* Print Modal */}
      <AnimatePresence>
        {printMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#151717] border border-[#2d2f2f] rounded-xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#ff444f]/10 rounded-full flex items-center justify-center mb-6">
                  <Bell className="text-[#ff444f]" size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-4">Bot Notification</h3>
                <p className="text-[#aaaaaa] mb-8 text-lg leading-relaxed">
                  {printMessage}
                </p>
                <button
                  onClick={() => setPrintMessage(null)}
                  className="w-full py-4 bg-[#4682b4] text-white font-bold rounded-lg hover:bg-[#4682b4]/90 transition-all text-lg"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
