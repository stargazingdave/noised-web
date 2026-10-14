import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OscParam } from '../types/osc-param';
import { AmpToggleSwitch } from './amp-toggle-switch';
import { Knob } from './knob';
import React, { FC, useState } from 'react';
import { IoHelp } from 'react-icons/io5';
import { SineWave } from './demos/sine-wave';

interface OscParamControllerProps {
  label: React.ReactNode;
  param: OscParam;
  onChange: (newParam: OscParam) => void;
  valueRange: [number, number];
  ampRange?: [number, number];
  freqRange?: [number, number];
  step?: number;
  tooltipText?: string;
}

export const OscParamController: React.FC<OscParamControllerProps> = ({
  label,
  param,
  onChange,
  valueRange,
  ampRange = [0, 1],
  freqRange = [0.01, 100],
  step = 0.01,
  tooltipText,
}) => {
  const update = (updates: Partial<OscParam>) => {
    onChange({ ...param, ...updates });
  };

  return (
    <div className="h-fit flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2 font-bold">
        <Popover>
          <PopoverTrigger asChild>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white bg-neutral-500 hover:bg-neutral-600 cursor-default">
              <IoHelp className="w-4 h-4" />
            </span>
          </PopoverTrigger>
          <PopoverContent side="top" className="z-50 w-72 sm:w-lg max-w-full text-sm">
            {
              tooltipText && <>
                <p>{tooltipText}</p>
                <br /></>
            }
            <Instructions />
          </PopoverContent>
        </Popover>
        {label}
      </div>

      <div className='h-fit flex items-end gap-4'>
        <div className='h-full flex flex-col items-center gap-2'>
          <Knob
            value={param.value}
            onChange={(val) => update({ value: val })}
            min={valueRange[0]}
            max={valueRange[1]}
            step={step}
            label="Value"
            size={80}
            trackWidth={0}
            colors={{
              face: '#de006b',
            }}
          />
        </div>

        <div className="flex flex-col items-center gap-2 h-fit">
          <div className='flex items-center gap-2 text-xs mt-1'>
            <AmpToggleSwitch
              checked={param.osc}
              onChange={(val) => update({ osc: val })}
              label="Oscillator"
            />
            <div className={`w-2 h-2 rounded-full border border-[#222] shadow-sm transition-all duration-300 ${param.osc ? 'bg-red-500 shadow-[0_0_6px_#f00a]' : 'bg-[#220000]'}`} />
          </div>
          <div className="flex gap-4">
            <Knob
              value={param.amp}
              onChange={(val) => update({ amp: val })}
              min={ampRange[0]}
              max={ampRange[1]}
              step={step}
              label="Amp"
              size={50}
              disabled={!param.osc}
              trackWidth={0}
              colors={{
                face: '#de006b',
              }}
            />
            <Knob
              value={param.freq}
              onChange={(val) => update({ freq: val })}
              min={freqRange[0]}
              max={freqRange[1]}
              step={0.01}
              label="Freq"
              size={50}
              disabled={!param.osc}
              trackWidth={0}
              colors={{
                face: '#de006b',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Instructions: FC = () => {
  const [sine, setSine] = useState<OscParam>({
    amp: 0.1,
    freq: 1,
    osc: true,
    value: 0.5,
  });

  return <div className='w-full h-full flex flex-col justify-between gap-4'>
    <div className='max-w-[28rem] text-sm text-neutral-500'>
      <h1 className='font-bold text-2xl'>Oscillating Parameter Controller</h1>
      <p>You can toggle between a fixed value and an oscillating value.</p>
      <p>Adjust the <span className='font-bold'>Freq</span> to control the frequency of the oscillation.</p>
      <p>Adjust the <span className='font-bold'>Amp</span> to control the amplitude of the oscillation.</p>
    </div>
    <div className='w-full flex flex-wrap gap-4 items-stretch'>
      <OscParamController
        label="Sine Wave"
        param={sine}
        onChange={(p: OscParam) => setSine(p)}
        valueRange={[0, 1]}
        ampRange={[0, 1]}
        freqRange={[0, 10]}
      />
      <div className='h-auto w-52'>
        <SineWave param={sine} />
      </div>
    </div>
  </div>;
}
