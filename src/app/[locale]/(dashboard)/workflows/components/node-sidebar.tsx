'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, SearchLg, Zap } from '@untitledui/icons';

import { Input } from '@/components/ui/input/input';
import { cx } from '@/utils/cx';
import type { NodeDefinition } from '@/types/workflow';
import {
  getNodeDefinitionsByCategory,
  getSubcategories,
  getNodeDefinitionsBySubcategory,
  nodeCategories,
} from '../config/node-definitions';

interface NodeSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: string, nodeCategory: string) => void;
}

export function NodeSidebar({ onDragStart }: NodeSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['trigger', 'condition', 'action']);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSubcategory = (subcategoryKey: string) => {
    setExpandedSubcategories((prev) =>
      prev.includes(subcategoryKey)
        ? prev.filter((id) => id !== subcategoryKey)
        : [...prev, subcategoryKey]
    );
  };

  const filterNodes = (nodes: NodeDefinition[]) => {
    if (!searchQuery) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.subcategory?.toLowerCase().includes(query)
    );
  };

  const handleDragStart = (
    event: React.DragEvent,
    node: NodeDefinition
  ) => {
    onDragStart(event, node.type, node.category);
  };

  const renderNodeItem = (node: NodeDefinition, categoryId: string) => (
    <div
      key={node.type}
      draggable
      onDragStart={(e) => handleDragStart(e, node)}
      className={cx(
        'flex cursor-grab items-center gap-2 rounded-md border border-secondary p-2 transition-colors',
        'hover:border-brand-300 hover:bg-secondary active:cursor-grabbing',
        'dark:hover:border-brand-700'
      )}
    >
      <div
        className={cx(
          'flex size-8 items-center justify-center rounded',
          categoryId === 'trigger' && 'bg-green-100 dark:bg-green-900',
          categoryId === 'condition' && 'bg-amber-100 dark:bg-amber-900',
          categoryId === 'action' && 'bg-blue-100 dark:bg-blue-900'
        )}
      >
        <Zap
          className={cx(
            'size-4',
            categoryId === 'trigger' && 'text-green-600 dark:text-green-400',
            categoryId === 'condition' && 'text-amber-600 dark:text-amber-400',
            categoryId === 'action' && 'text-blue-600 dark:text-blue-400'
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-primary">{node.label}</p>
        <p className="truncate text-[10px] text-tertiary">{node.description}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-64 flex-col border-r border-secondary bg-primary">
      {/* Header */}
      <div className="border-b border-secondary p-4">
        <h3 className="text-sm font-semibold text-primary">Bausteine</h3>
        <p className="mt-1 text-xs text-tertiary">Ziehen Sie Elemente auf die Arbeitsfläche</p>
      </div>

      {/* Search */}
      <div className="border-b border-secondary p-3">
        <Input
          size="sm"
          icon={SearchLg}
          placeholder="Suchen..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto">
        {nodeCategories.map((category) => {
          const categoryType = category.id as 'trigger' | 'condition' | 'action';
          const allNodes = getNodeDefinitionsByCategory(categoryType);
          const filteredNodes = filterNodes(allNodes);
          const subcategories = getSubcategories(categoryType);
          const isExpanded = expandedCategories.includes(category.id);

          if (searchQuery && filteredNodes.length === 0) return null;

          return (
            <div key={category.id} className="border-b border-secondary">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="size-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm font-medium text-primary">{category.label}</span>
                  <span className="text-xs text-tertiary">({filteredNodes.length})</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="size-4 text-tertiary" />
                ) : (
                  <ChevronRight className="size-4 text-tertiary" />
                )}
              </button>

              {/* Category Content - with subcategories */}
              {isExpanded && (
                <div className="pb-2">
                  {searchQuery ? (
                    // When searching, show flat list
                    <div className="space-y-1 px-2">
                      {filteredNodes.map((node) => renderNodeItem(node, category.id))}
                    </div>
                  ) : (
                    // When not searching, group by subcategory
                    subcategories.map((subcategory) => {
                      const subcategoryNodes = getNodeDefinitionsBySubcategory(categoryType, subcategory);
                      const subcategoryKey = `${category.id}-${subcategory}`;
                      const isSubcategoryExpanded = expandedSubcategories.includes(subcategoryKey);

                      return (
                        <div key={subcategoryKey}>
                          {/* Subcategory Header */}
                          <button
                            onClick={() => toggleSubcategory(subcategoryKey)}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-secondary"
                          >
                            <span className="text-xs font-medium text-tertiary">{subcategory}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-quaternary">({subcategoryNodes.length})</span>
                              {isSubcategoryExpanded ? (
                                <ChevronDown className="size-3 text-quaternary" />
                              ) : (
                                <ChevronRight className="size-3 text-quaternary" />
                              )}
                            </div>
                          </button>

                          {/* Subcategory Nodes */}
                          {isSubcategoryExpanded && (
                            <div className="space-y-1 px-2 pb-1">
                              {subcategoryNodes.map((node) => renderNodeItem(node, category.id))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Help */}
      <div className="border-t border-secondary p-3">
        <p className="text-xs text-tertiary">
          Tipp: Verbinden Sie Bausteine, indem Sie von einem Ausgang zu einem Eingang ziehen.
        </p>
      </div>
    </div>
  );
}
