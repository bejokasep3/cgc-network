import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserIcon,
  Building06Icon,
  CreditCardIcon,
  Logout01Icon,
  BubbleChatIcon,
} from '@hugeicons/core-free-icons';

// Small line icons for the account dropdown's menu items, from Hugeicons.
// sanitize.css sets a global `svg { fill: currentColor }` rule that overrides
// the icons' `fill="none"` attribute, so fill:none is forced back via inline
// style (which beats stylesheet rules) to keep these as outlines, not solid shapes.
const iconProps = {
  size: 18,
  strokeWidth: 1.8,
  style: { fill: 'none' },
};

export const IconProfile = () => <HugeiconsIcon icon={UserIcon} {...iconProps} />;

export const IconBrand = () => <HugeiconsIcon icon={Building06Icon} {...iconProps} />;

export const IconSubscription = () => <HugeiconsIcon icon={CreditCardIcon} {...iconProps} />;

export const IconLogout = () => <HugeiconsIcon icon={Logout01Icon} {...iconProps} />;

export const IconChat = () => <HugeiconsIcon icon={BubbleChatIcon} {...iconProps} />;
