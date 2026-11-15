import React from 'react';
import { AlarmClock, Bell, Plus, Trash2, Clock } from 'lucide-react';
import { AutoBotAlarm } from '../../types/autobot';
import { formatTimeToAMPM } from '../../lib/autobotEngines';
import { cn } from '../../lib/utils';

interface AutoBotAlarmSchedulerProps {
  alarms: AutoBotAlarm[];
  isAlarmSchedulerEnabled: boolean;
  setIsAlarmSchedulerEnabled: (val: boolean) => void;
  newAlarmTime: string;
  setNewAlarmTime: (val: string) => void;
  newAlarmLabel: string;
  setNewAlarmLabel: (val: string) => void;
  newAlarmDays: number[];
  setNewAlarmDays: (val: number[]) => void;
  currentTimeStr: string;
  handleAddAlarm: (e?: React.FormEvent) => void;
  handleToggleAlarm: (id: string) => void;
  handleDeleteAlarm: (id: string) => void;
  notify: (type: 'info' | 'success' | 'error' | 'warn', msg: string) => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const AutoBotAlarmScheduler: React.FC<AutoBotAlarmSchedulerProps> = ({
  alarms,
  isAlarmSchedulerEnabled,
  setIsAlarmSchedulerEnabled,
  newAlarmTime,
  setNewAlarmTime,
  newAlarmLabel,
  setNewAlarmLabel,
  newAlarmDays,
  setNewAlarmDays,
  currentTimeStr,
  handleAddAlarm,
  handleToggleAlarm,
  handleDeleteAlarm,
  notify,
}) => {
  const { time12, ampm } = formatTimeToAMPM(currentTimeStr);

  const toggleDay = (dayIdx: number) => {
    if (newAlarmDays.includes(dayIdx)) {
      if (newAlarmDays.length > 1) {
        setNewAlarmDays(newAlarmDays.filter((d) => d !== dayIdx));
      }
    } else {
      setNewAlarmDays([...newAlarmDays, dayIdx].sort((a, b) => a - b));
    }
  };

  return (
    <div className="p-3 bg-[#0c0d0f] border border-[#1a1b1e] rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#ff444f]/10 border border-[#ff444f]/30 flex items-center justify-center shrink-0">
            <AlarmClock size={14} className="text-[#ff444f]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-black text-white uppercase tracking-wider truncate">
              Scheduled Auto-Start
            </span>
            <span className="block text-[9px] text-slate-500 font-mono">
              {time12} {ampm}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !isAlarmSchedulerEnabled;
            setIsAlarmSchedulerEnabled(next);
            notify('info', `Alarm Scheduler turned ${next ? 'ON' : 'OFF'}.`);
          }}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            isAlarmSchedulerEnabled ? 'bg-[#ff444f]' : 'bg-[#222428]'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              isAlarmSchedulerEnabled ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Add Alarm Form */}
      <form onSubmit={handleAddAlarm} className="space-y-2 pt-2 border-t border-[#1d1f23]">
        <div className="flex items-center gap-1.5">
          <input
            type="time"
            value={newAlarmTime}
            onChange={(e) => setNewAlarmTime(e.target.value)}
            className="bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#ff444f]"
          />
          <input
            type="text"
            value={newAlarmLabel}
            onChange={(e) => setNewAlarmLabel(e.target.value)}
            placeholder="Alarm label (optional)"
            className="flex-1 min-w-0 bg-[#0e0f11] border border-[#222428] text-white text-[11px] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ff444f]"
          />
          <button
            type="submit"
            title="Add Scheduled Alarm"
            className="p-1.5 rounded-lg bg-[#ff444f] hover:bg-[#e63a44] text-white shrink-0 transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-1">
          {DAY_LABELS.map((lbl, idx) => {
            const active = newAlarmDays.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className={cn(
                  'flex-1 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer',
                  active
                    ? 'bg-[#ff444f]/20 border-[#ff444f]/60 text-[#ff444f]'
                    : 'bg-[#111214] border-[#222428] text-slate-500 hover:text-slate-300'
                )}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </form>

      {/* Alarm List */}
      {alarms.length > 0 ? (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5 custom-scrollbar">
          {alarms.map((alarm) => {
            const formatted = formatTimeToAMPM(alarm.time);
            return (
              <div
                key={alarm.id}
                className={cn(
                  'flex items-center justify-between gap-2 p-2 rounded-lg border text-[11px] transition-all',
                  alarm.enabled
                    ? 'bg-[#121318] border-[#292c36] text-white'
                    : 'bg-[#0e0f11] border-[#1c1d22] text-slate-500'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Bell
                      size={11}
                      className={alarm.enabled ? 'text-[#ff444f]' : 'text-slate-600'}
                    />
                    <span className="font-mono font-bold">
                      {formatted.time12} {formatted.ampm}
                    </span>
                    {alarm.label && (
                      <span className="text-[10px] text-slate-400 truncate">· {alarm.label}</span>
                    )}
                  </div>
                  {alarm.days && alarm.days.length > 0 && (
                    <div className="text-[8px] font-mono text-slate-500 mt-0.5">
                      {alarm.days.map((d) => DAY_LABELS[d]).join(' ')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAlarm(alarm.id)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer',
                      alarm.enabled
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    )}
                  >
                    {alarm.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlarm(alarm.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                    aria-label="Delete alarm"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono py-1">
          <Clock size={11} />
          <span>No scheduled auto-start alarms set</span>
        </div>
      )}
    </div>
  );
};
