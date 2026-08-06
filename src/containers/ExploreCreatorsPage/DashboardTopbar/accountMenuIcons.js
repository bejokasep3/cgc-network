import React from 'react';
import { User, Building2, CreditCard, LogOut, MessageCircle } from 'lucide-react';

// Small line icons for the account dropdown's menu items.
//
// lucide-react is the single icon set across the app — every src/components/Icon*
// component wraps it too. These used to come from Hugeicons, which meant two icon
// libraries with different stroke weights and corner treatments rendering side by
// side; that mismatch is the kind of thing people notice without being able to
// name it.
//
// sanitize.css sets a global `svg { fill: currentColor }` rule that overrides
// the icons' `fill="none"` attribute, so fill:none is forced back via inline
// style (which beats stylesheet rules) to keep these as outlines, not solid shapes.
const iconProps = {
  size: 18,
  strokeWidth: 1.8,
  style: { fill: 'none' },
};

export const IconProfile = () => <User {...iconProps} />;

export const IconBrand = () => <Building2 {...iconProps} />;

export const IconSubscription = () => <CreditCard {...iconProps} />;

export const IconLogout = () => <LogOut {...iconProps} />;

export const IconChat = () => <MessageCircle {...iconProps} />;
