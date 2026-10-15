import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OscParam } from '../types/osc-param';
import { AmpToggleSwitch } from 'noised-ui';
import { Knob } from 'noised-ui';
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

      <div className="parameter-controls parameter-controls--wide">
        <div className="parameter-value parameter-value--full">
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

        <div className="parameter-modulation">
          <div className="parameter-toggle-row">
            <AmpToggleSwitch
              checked={param.osc}
              onChange={(val) => update({ osc: val })}
              label="Oscillator"
            />
            <div className="parameter-indicator" data-active={param.osc} />
          </div>
          <div className="control-pair">
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

  return <div className="parameter-instructions">
    <div className="parameter-instructions-copy">
      <h1 className="parameter-instructions-title">Oscillating Parameter Controller</h1>
      <p>You can toggle between a fixed value and an oscillating value.</p>
      <p>Adjust the <strong>Freq</strong> to control the frequency of the oscillation.</p>
      <p>Adjust the <strong>Amp</strong> to control the amplitude of the oscillation.</p>
    </div>
    <div className="parameter-example">
      <OscParamController
        label="Sine Wave"
        param={sine}
        onChange={(p: OscParam) => setSine(p)}
        valueRange={[0, 1]}
        ampRange={[0, 1]}
        freqRange={[0, 10]}
      />
      <div className="parameter-example-visual">
        <SineWave param={sine} />
      </div>
    </div>
  </div>;
}
