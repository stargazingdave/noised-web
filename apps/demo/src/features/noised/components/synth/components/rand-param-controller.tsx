import { RandParam } from '../types/rand-param';
import { AmpToggleSwitch } from './amp-toggle-switch';
import { ThemedKnob as Knob } from './themed-knob';
import React, { FC, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IoHelp } from 'react-icons/io5';
import { RandomBar } from './demos/random-bar';

interface RandParamControllerProps {
  label: React.ReactNode;
  param: RandParam;
  onChange: (newParam: RandParam) => void;
  valueRange: [number, number];
  distRange?: [number, number];
  step?: number;
  tooltipText?: string;
}

export const RandParamController: React.FC<RandParamControllerProps> = ({
  label,
  param,
  onChange,
  valueRange,
  distRange = [0, 1],
  step = 0.01,
  tooltipText
}) => {
  const update = (updates: Partial<RandParam>) => {
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

      <div className='flex items-end gap-2'>
        <div className='flex flex-col items-center gap-2'>
          <Knob
            value={param.value}
            onChange={(val) => update({ value: val })}
            min={valueRange[0]}
            max={valueRange[1]}
            step={step}
            label="Value"
            size={80}
            colors={{
              face: '#de006b',
            }}
          />
        </div>

        <div className="flex flex-col items-center gap-2 h-fit">
          <div className='flex items-center gap-2 text-xs mt-1'>
            <AmpToggleSwitch
              checked={param.rand}
              onChange={(val) => update({ rand: val })}
              label="Randomize"
            />
            <div className={`w-2 h-2 rounded-full border border-[#222] shadow-sm transition-all duration-300 ${param.rand ? 'bg-red-500 shadow-[0_0_6px_#f00a]' : 'bg-[#220000]'}`} />
          </div>

          <div className="flex gap-4">
            <Knob
              value={param.dist}
              onChange={(val) => update({ dist: val })}
              min={distRange[0]}
              max={distRange[1]}
              step={step}
              label="Dist"
              size={50}
              disabled={!param.rand}
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
  const [rand, setRand] = useState<RandParam>({
    dist: 0.1,
    rand: true,
    value: 0.5,
  });

  return <div className='w-full h-full flex flex-col justify-between gap-8'>
    <div className='max-w-[28rem] text-sm text-neutral-500'>
      <h1 className='font-bold text-2xl'>Random Parameter Controller</h1>
      <p>You can toggle between a fixed value and a random value.</p>
      <p>Adjust the <span className='font-bold'>Dist</span> to control how much variation there is around the set value.</p>
    </div>
    <div className='w-fit flex flex-wrap gap-4'>
      <RandParamController
        label="Random"
        param={rand}
        onChange={(p: RandParam) => setRand(p)}
        valueRange={[0, 1]}
        distRange={[0, 1]}
      />
      <div className='h-auto w-52'>
        <RandomBar param={rand} />
      </div>
    </div>
  </div>;
}
