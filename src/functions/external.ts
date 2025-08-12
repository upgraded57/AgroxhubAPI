import axios from "axios";

export const paystackInstance = axios.create({
  baseURL: "https://api.paystack.co",
});

paystackInstance.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.PAYSTACK_TEST_SECRET_KEY}`;
  config.headers["Content-Type"] = "application/json";
  return config;
});
