                <strong>{money(subtotal, state.currency)}</strong>
              </div>
              <div className="total-row">
                <span>
                  {isTax ? "Sales Tax" : "Taxes"}
                  <span className="tax-editor">
                    {" "}
                    (<NumberField
                      value={state.taxRate}
                      onChange={(value) => set("taxRate", value)}
                      ariaLabel="Tax rate percent"
                      style={{ width: `${Math.max(1, String(Number.isFinite(state.taxRate) ? state.taxRate : 0).length)}ch`, textAlign: "right", padding: 0 }}
                    />%)
                  </span>
                </span>
                <strong>{money(taxAmount, state.currency)}</strong>
              </div>