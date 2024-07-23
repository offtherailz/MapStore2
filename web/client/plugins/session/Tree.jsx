// src/Tree.js
import React, { useState } from 'react';
import { Glyphicon } from 'react-bootstrap';


const TreeNode = ({ node, onToggle, onCheck }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
        onToggle(node);
    };

    const handleCheck = (event) => {
        onCheck(node, event.target.checked);
    };

    return (
        <div style={{ marginLeft: 20 }}>
            <div>
                {node.children && (
                    <Glyphicon onClick={handleToggle} glyph={isExpanded ? 'chevron-down' : 'chevron-right'} />

                )}
                <input type="checkbox" style={{marginRight: 3}} checked={node.checked || false} onChange={handleCheck} />
                {node.label}
            </div>
            {isExpanded && node.children && (
                <div>
                    {node.children.map(childNode => (
                        <TreeNode
                            key={childNode.id}
                            node={childNode}
                            onToggle={onToggle}
                            onCheck={onCheck}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const Tree = ({ data }) => {
    const [treeData, setTreeData] = useState(data);

    const handleToggle = (node) => {
        const updateTree = (nodes) =>
            nodes.map((n) => {
                if (n.id === node.id) {
                    n.isExpanded = !n.isExpanded;
                }
                if (n.children) {
                    n.children = updateTree(n.children);
                }
                return n;
            });
        setTreeData(updateTree(treeData));
    };

    const handleCheck = (node, isChecked) => {
        const updateTree = (nodes) =>
            nodes.map((n) => {
                if (n.id === node.id) {
                    n.checked = isChecked;
                }
                if (n.children) {
                    n.children = updateTree(n.children);
                }
                return n;
            });
        setTreeData(updateTree(treeData));
    };

    return (
        <div>
            {treeData.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    onToggle={handleToggle}
                    onCheck={handleCheck}
                />
            ))}
        </div>
    );
};

export default Tree;
