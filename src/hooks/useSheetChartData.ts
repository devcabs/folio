export function useSheetChartData(_options?: any) {
  return {
    dataset: null as any,
    config: null as any,
    reload: () => {},
    status: "idle" as any,
    errorMessage: null,
    syncLiveSheet: async () => {},
  };
}
export default useSheetChartData;
