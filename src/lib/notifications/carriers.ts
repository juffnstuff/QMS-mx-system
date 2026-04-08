export const SMS_CARRIERS = [
  { name: "Verizon", domain: "vtext.com" },
  { name: "AT&T", domain: "txt.att.net" },
  { name: "T-Mobile", domain: "tmomail.net" },
  { name: "Sprint", domain: "messaging.sprintpcs.com" },
  { name: "US Cellular", domain: "email.uscc.net" },
  { name: "Cricket", domain: "sms.cricketwireless.net" },
  { name: "Metro by T-Mobile", domain: "mymetropcs.com" },
  { name: "Boost Mobile", domain: "sms.myboostmobile.com" },
  { name: "Google Fi", domain: "msg.fi.google.com" },
  { name: "Xfinity Mobile", domain: "vtext.com" },
] as const;

export type CarrierDomain = (typeof SMS_CARRIERS)[number]["domain"];
