<?php

namespace Vizuall\BorderRadius\Fieldtypes;

use Statamic\Fields\Fieldtype;

class BorderRadius extends Fieldtype
{
    protected static $handle = 'border_radius';
    protected static $title  = 'Border Radius';

    public function component(): string
    {
        return 'border-radius';
    }

    protected function configFieldItems(): array
    {
        return [
            'min' => [
                'display' => __('Min'),
                'type'    => 'integer',
                'default' => 0,
                'width'   => 25,
            ],
            'max' => [
                'display' => __('Max'),
                'type'    => 'integer',
                'default' => 100,
                'width'   => 25,
            ],
            'step' => [
                'display' => __('Step'),
                'type'    => 'integer',
                'default' => 1,
                'width'   => 25,
            ],
        ];
    }

    public function preProcess($value): array
    {
        if (is_array($value) && isset($value['rows'])) {
            return $value;
        }
        $rows = is_array($value) && count($value) > 0
            ? $value
            : [['corners' => ['top-left'], 'value' => $this->config('min', 0), 'custom' => false]];
        return ['unit' => $this->config('unit', 'px'), 'rows' => $rows];
    }

    public function augment($value): array
    {
        $unit = $value['unit'] ?? $this->config('unit', 'px');
        $rows = $value['rows'] ?? (is_array($value) && !isset($value['unit']) ? $value : []);

        return [
            'unit' => $unit,
            'rows' => collect($rows)->map(function ($row) use ($unit) {
                $corners = (array) ($row['corners'] ?? []);
                $val     = $row['value'] ?? null;
                return [
                    'corners'      => $corners,
                    'value'        => $val,
                    'css'          => is_numeric($val) ? $val . $unit : (string) $val,
                    'custom'       => (bool) ($row['custom'] ?? false)
                        || (isset($val) && is_string($val) && !is_numeric($val)),
                    'top_left'     => in_array('top-left',     $corners),
                    'top_right'    => in_array('top-right',    $corners),
                    'bottom_right' => in_array('bottom-right', $corners),
                    'bottom_left'  => in_array('bottom-left',  $corners),
                ];
            })->all(),
        ];
    }

    public function process($value): array
    {
        if (!is_array($value)) {
            return ['unit' => $this->config('unit', 'px'), 'rows' => []];
        }

        $unit = $value['unit'] ?? $this->config('unit', 'px');
        $rows = $value['rows'] ?? [];

        $step     = $this->config('step', 1);
        $useFloat = strpos((string) $step, '.') !== false;

        $processedRows = collect($rows)
            ->map(function ($row) use ($useFloat) {
                $val      = $row['value'] ?? null;
                $isCustom = (bool) ($row['custom'] ?? false)
                    || (is_string($val) && !is_numeric($val));
                if (!$isCustom) {
                    $val = $useFloat ? (float) $val : (int) $val;
                } else {
                    $val = (string) $val;
                }
                return [
                    'corners' => array_values((array) $row['corners']),
                    'value'   => $val,
                    'custom'  => $isCustom,
                ];
            })
            ->values()
            ->all();

        return ['unit' => $unit, 'rows' => $processedRows];
    }
}
