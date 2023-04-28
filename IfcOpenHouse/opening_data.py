door_params = {
    'operation_type': 'SINGLE_SWING_LEFT',
    'overall_height': 2.2,
    'overall_width': 1.,
    'lining_properties': {
        'LiningDepth': 0.05,
        'LiningThickness': 0.05,
        'LiningOffset': 0.,
        'LiningToPanelOffsetX': 0.025,
        'LiningToPanelOffsetY': 0.025,
        'TransomThickness': 0.,
        'TransomOffset': 1.525,
        'CasingThickness': 0.075,
        'CasingDepth': 0.005,
        'ThresholdThickness': 0.025,
        'ThresholdDepth': 0.1,
        'ThresholdOffset': 0.,
    },
    'panel_properties': {
        'PanelDepth': 0.035,
        'PanelWidth': 1.,
        'FrameDepth': 0.035,
        'FrameThickness': 0.035,
    },
}

common_window_params = {
    'overall_height': 1.6,
    'lining_properties': {
        'LiningDepth': 0.05,
        'LiningThickness': 0.05,
        'LiningOffset': 0.05,
        'LiningToPanelOffsetX': 0.025,
        'LiningToPanelOffsetY': 0.025,
        'MullionThickness': 0.05,
        'FirstMullionOffset': 5.5/3,
        'SecondMullionOffset': 2*5.5/3,
        'TransomThickness': 0.05,
        'FirstTransomOffset': 0.,
        'SecondTransomOffset': 0.,
    }
}

window_panel_properties = {
    'FrameDepth': 0.035,
    'FrameThickness': 0.035
}

single_window_params = {
    'partition_type': 'SINGLE_PANEL',
    'overall_width': 1.86,
    'panel_properties': [window_panel_properties],
    **common_window_params
    }


triple_window_params = {
    'partition_type': 'TRIPLE_PANEL_VERTICAL',
    'overall_width': 5.5,
    'panel_properties': 3 * [window_panel_properties],
    **common_window_params
}
