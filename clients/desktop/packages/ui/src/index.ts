/**
 * @fileoverview Exposes shared Solid controls, dialog composition, and virtual geometry
 * while leaving business data and view state to consumers.
 */

export { Button } from './components/button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button'
export {
  TextField,
  TextFieldLabel,
  TextFieldDescription,
  TextFieldErrorMessage,
  TextFieldInput,
  TextFieldTextArea,
} from './components/text-field'
export type {
  TextFieldProps,
  TextFieldInputProps,
  TextFieldTextAreaProps,
  TextFieldLabelProps,
  TextFieldDescriptionProps,
  TextFieldErrorMessageProps,
} from './components/text-field'
export { Field, FieldContent, Fieldset, FieldLegend } from './components/field'
export type { FieldProps } from './components/field'
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogContent,
} from './components/dialog'
export type {
  DialogProps,
  DialogTriggerProps,
  DialogCloseProps,
  DialogContentProps,
  DialogTitleProps,
  DialogDescriptionProps,
} from './components/dialog'
export { createVirtualizer, createWindowVirtualizer, defaultRangeExtractor } from './virtual'
export type {
  Virtualizer,
  VirtualizerOptions,
  VirtualItem,
  Range,
  ScrollToOptions,
} from './virtual'

export { Badge } from './components/badge'
export type { BadgeProps, BadgeVariant } from './components/badge'
export { Separator } from './components/separator'
export type { SeparatorProps } from './components/separator'
export { Spinner } from './components/spinner'
export type { SpinnerProps } from './components/spinner'
export { Alert, AlertTitle, AlertDescription } from './components/alert'
export type { AlertProps, AlertVariant } from './components/alert'
export { EmptyState, EmptyStateTitle, EmptyStateDescription } from './components/empty-state'
export type { EmptyStateProps } from './components/empty-state'
export { ScrollRegion } from './components/scroll-region'
export type { ScrollRegionProps } from './components/scroll-region'
export {
  Table,
  TableCaption,
  TableHead,
  TableBody,
  TableFoot,
  TableRow,
  TableHeaderCell,
  TableCell,
} from './components/table'
export type { TableProps } from './components/table'
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from './components/alert-dialog'
export type {
  AlertDialogProps,
  AlertDialogTriggerProps,
  AlertDialogCloseProps,
  AlertDialogContentProps,
  AlertDialogTitleProps,
  AlertDialogDescriptionProps,
} from './components/alert-dialog'

export {
  Checkbox,
  CheckboxInput,
  CheckboxControl,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxDescription,
  CheckboxErrorMessage,
} from './components/checkbox'
export type {
  CheckboxProps,
  CheckboxInputProps,
  CheckboxControlProps,
  CheckboxIndicatorProps,
  CheckboxLabelProps,
  CheckboxDescriptionProps,
  CheckboxErrorMessageProps,
} from './components/checkbox'
export {
  Switch,
  SwitchInput,
  SwitchControl,
  SwitchThumb,
  SwitchLabel,
  SwitchDescription,
  SwitchErrorMessage,
} from './components/switch'
export type {
  SwitchProps,
  SwitchInputProps,
  SwitchControlProps,
  SwitchThumbProps,
  SwitchLabelProps,
  SwitchDescriptionProps,
  SwitchErrorMessageProps,
} from './components/switch'
export {
  RadioGroup,
  RadioGroupLabel,
  RadioGroupDescription,
  RadioGroupErrorMessage,
  RadioGroupItem,
  RadioGroupItemInput,
  RadioGroupItemControl,
  RadioGroupItemIndicator,
  RadioGroupItemLabel,
  RadioGroupItemDescription,
} from './components/radio-group'
export type {
  RadioGroupProps,
  RadioGroupLabelProps,
  RadioGroupDescriptionProps,
  RadioGroupErrorMessageProps,
  RadioGroupItemProps,
  RadioGroupItemInputProps,
  RadioGroupItemControlProps,
  RadioGroupItemIndicatorProps,
  RadioGroupItemLabelProps,
  RadioGroupItemDescriptionProps,
} from './components/radio-group'
export {
  Select,
  SelectLabel,
  SelectDescription,
  SelectErrorMessage,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectListbox,
  SelectItem,
  SelectItemLabel,
  SelectItemDescription,
  SelectItemIndicator,
  SelectSection,
  SelectHiddenSelect,
} from './components/select'
export type {
  SelectProps,
  SelectLabelProps,
  SelectDescriptionProps,
  SelectErrorMessageProps,
  SelectTriggerProps,
  SelectValueProps,
  SelectIconProps,
  SelectContentProps,
  SelectListboxProps,
  SelectItemProps,
  SelectItemLabelProps,
  SelectItemDescriptionProps,
  SelectItemIndicatorProps,
  SelectSectionProps,
  SelectHiddenSelectProps,
} from './components/select'
export {
  Combobox,
  ComboboxLabel,
  ComboboxDescription,
  ComboboxErrorMessage,
  ComboboxControl,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxIcon,
  ComboboxContent,
  ComboboxListbox,
  ComboboxItem,
  ComboboxItemLabel,
  ComboboxItemDescription,
  ComboboxItemIndicator,
  ComboboxSection,
  ComboboxHiddenSelect,
} from './components/combobox'
export type {
  ComboboxProps,
  ComboboxLabelProps,
  ComboboxDescriptionProps,
  ComboboxErrorMessageProps,
  ComboboxControlProps,
  ComboboxInputProps,
  ComboboxTriggerProps,
  ComboboxIconProps,
  ComboboxContentProps,
  ComboboxListboxProps,
  ComboboxItemProps,
  ComboboxItemLabelProps,
  ComboboxItemDescriptionProps,
  ComboboxItemIndicatorProps,
  ComboboxSectionProps,
  ComboboxHiddenSelectProps,
} from './components/combobox'
export {
  Slider,
  SliderLabel,
  SliderDescription,
  SliderErrorMessage,
  SliderTrack,
  SliderFill,
  SliderThumb,
  SliderInput,
  SliderValueLabel,
} from './components/slider'
export type {
  SliderProps,
  SliderLabelProps,
  SliderDescriptionProps,
  SliderErrorMessageProps,
  SliderTrackProps,
  SliderFillProps,
  SliderThumbProps,
  SliderInputProps,
  SliderValueLabelProps,
} from './components/slider'
export { Tabs, TabsList, TabsTrigger, TabsContent, TabsIndicator } from './components/tabs'
export type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  TabsIndicatorProps,
} from './components/tabs'
export {
  SegmentedControl,
  SegmentedControlLabel,
  SegmentedControlItem,
  SegmentedControlItemInput,
  SegmentedControlItemControl,
  SegmentedControlItemLabel,
  SegmentedControlIndicator,
  SegmentedControlDescription,
  SegmentedControlErrorMessage,
} from './components/segmented-control'
export type {
  SegmentedControlProps,
  SegmentedControlLabelProps,
  SegmentedControlItemProps,
  SegmentedControlItemInputProps,
  SegmentedControlItemControlProps,
  SegmentedControlItemLabelProps,
  SegmentedControlIndicatorProps,
  SegmentedControlDescriptionProps,
  SegmentedControlErrorMessageProps,
} from './components/segmented-control'
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/collapsible'
export type {
  CollapsibleProps,
  CollapsibleTriggerProps,
  CollapsibleContentProps,
} from './components/collapsible'
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemLabel,
  DropdownMenuItemDescription,
  DropdownMenuItemIndicator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './components/dropdown-menu'
export type {
  DropdownMenuProps,
  DropdownMenuTriggerProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuItemLabelProps,
  DropdownMenuItemDescriptionProps,
  DropdownMenuItemIndicatorProps,
  DropdownMenuCheckboxItemProps,
  DropdownMenuRadioGroupProps,
  DropdownMenuRadioItemProps,
  DropdownMenuGroupProps,
  DropdownMenuGroupLabelProps,
  DropdownMenuSeparatorProps,
  DropdownMenuSubProps,
  DropdownMenuSubTriggerProps,
  DropdownMenuSubContentProps,
} from './components/dropdown-menu'
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemLabel,
  ContextMenuItemDescription,
  ContextMenuItemIndicator,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from './components/context-menu'
export type {
  ContextMenuProps,
  ContextMenuTriggerProps,
  ContextMenuContentProps,
  ContextMenuItemProps,
  ContextMenuItemLabelProps,
  ContextMenuItemDescriptionProps,
  ContextMenuItemIndicatorProps,
  ContextMenuCheckboxItemProps,
  ContextMenuRadioGroupProps,
  ContextMenuRadioItemProps,
  ContextMenuGroupProps,
  ContextMenuGroupLabelProps,
  ContextMenuSeparatorProps,
  ContextMenuSubProps,
  ContextMenuSubTriggerProps,
  ContextMenuSubContentProps,
} from './components/context-menu'
export {
  Popover,
  PopoverAnchor,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
} from './components/popover'
export type {
  PopoverProps,
  PopoverAnchorProps,
  PopoverTriggerProps,
  PopoverContentProps,
  PopoverTitleProps,
  PopoverDescriptionProps,
  PopoverCloseProps,
} from './components/popover'
export { Tooltip, TooltipTrigger, TooltipContent } from './components/tooltip'
export type { TooltipProps, TooltipTriggerProps, TooltipContentProps } from './components/tooltip'
export {
  Progress,
  ProgressLabel,
  ProgressValueLabel,
  ProgressTrack,
  ProgressFill,
} from './components/progress'
export type {
  ProgressProps,
  ProgressLabelProps,
  ProgressValueLabelProps,
  ProgressTrackProps,
  ProgressFillProps,
} from './components/progress'
export {
  ToastRegion,
  ToastList,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastProgressTrack,
  ToastProgressFill,
  toaster,
} from './components/toast'
export type {
  ToastRegionProps,
  ToastListProps,
  ToastProps,
  ToastTitleProps,
  ToastDescriptionProps,
  ToastCloseProps,
  ToastProgressTrackProps,
  ToastProgressFillProps,
} from './components/toast'
export { Link } from './components/link'
export type { LinkProps } from './components/link'
export { Image, ImageImg, ImageFallback } from './components/image'
export type { ImageProps, ImageImgProps, ImageFallbackProps } from './components/image'
