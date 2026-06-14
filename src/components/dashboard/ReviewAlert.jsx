import React from "react";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReviewAlert({ salesCount, bankCount }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-yellow-800 space-y-1">
        <p className="font-semibold">Action needed — records require review</p>
        <div className="flex flex-wrap gap-3 mt-1">
          {salesCount > 0 && (
            <Link to="/review-sales" className="underline hover:text-yellow-900">
              {salesCount} sales record{salesCount !== 1 ? "s" : ""}
            </Link>
          )}
          {bankCount > 0 && (
            <Link to="/review-bank" className="underline hover:text-yellow-900">
              {bankCount} bank transaction{bankCount !== 1 ? "s" : ""}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}