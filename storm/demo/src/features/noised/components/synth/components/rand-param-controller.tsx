import { RandParam } from '../types/rand-param';
import { AmpToggleSwitch } from 'noised-ui';
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
    <div className="parameter-controller">
      <div className="parameter-heading">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Parameter help" className="parameter-help">
              <IoHelp className="parameter-help-icon" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="parameter-popover">
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

      <div className="parameter-controls">
        <div className="parameter-value">
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

        <div className="parameter-modulation">
          <div className="parameter-toggle-row">
            <AmpToggleSwitch
              checked={param.rand}
              onChange={(val) => update({ rand: val })}
              label="Randomize"
            />
            <div className="parameter-indicator" data-active={param.rand} />
          </div>

          <div className="control-pair">
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

  return <div className="parameter-instructions">
    <div className="parameter-instructions-copy">
      <h1 className="parameter-instructions-title">Random Parameter Controller</h1>
      <p>You can toggle between a fixed value and a random value.</p>
      <p>Adjust the <strong>Dist</strong> to control how much variation there is around the set value.</p>
    </div>
    <div className="parameter-example">
      <RandParamController
        label="Random"
        param={rand}
        onChange={(p: RandParam) => setRand(p)}
        valueRange={[0, 1]}
        distRange={[0, 1]}
      />
      <div className="parameter-example-visual">
        <RandomBar param={rand} />
      </div>
    </div>
  </div>;
}
